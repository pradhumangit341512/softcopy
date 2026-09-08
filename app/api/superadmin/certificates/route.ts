/**
 * /api/superadmin/certificates
 *
 * GET  → list issued internship certificates (search + pagination).
 * POST → issue a new internship certificate. Generates a unique public
 *        certificateId and an unguessable verifyToken for the QR link.
 *
 * Both endpoints are gated to role=superadmin in middleware AND re-checked
 * inside the handler (defense in depth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { isValidObjectId } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/superadmin';
import { createCertificateSchema, parseBody } from '@/lib/validations';
import {
  generateCertificateId,
  generateVerifyToken,
  buildVerifyUrl,
} from '@/lib/certificates';
import { DEFAULT_ORGANIZATION } from '@/lib/certificate-options';
import { recordAudit } from '@/lib/audit';
import { escapeRegex } from '@/lib/utils';

export const runtime = 'nodejs';

// ==================== GET — list certificates ====================

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));
  const skip = (page - 1) * limit;
  const search = searchParams.get('search') ?? '';
  const team = searchParams.get('team') ?? '';
  const status = searchParams.get('status') ?? '';

  const where: Prisma.InternshipCertificateWhereInput = { deletedAt: null };
  if (team) where.team = team;
  if (status === 'active' || status === 'revoked') where.status = status;
  if (search) {
    const rx = { contains: escapeRegex(search), mode: 'insensitive' as const };
    where.OR = [
      { internName: rx },
      { certificateId: rx },
      { role: rx },
      { rollNumber: rx },
    ];
  }

  const [certificates, total] = await Promise.all([
    db.internshipCertificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        certificateId: true,
        internName: true,
        role: true,
        team: true,
        startDate: true,
        endDate: true,
        issueDate: true,
        status: true,
        createdAt: true,
      },
    }),
    db.internshipCertificate.count({ where }),
  ]);

  return NextResponse.json({
    certificates,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ==================== POST — issue certificate ====================

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, createCertificateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const verifyToken = generateVerifyToken();
  const year = new Date().getFullYear();

  // Retry on the (extremely unlikely) unique-index collision for certificateId.
  // MongoDB has no multi-doc transaction guarantee here, but @unique on
  // certificateId makes the create atomic — a duplicate throws P2002.
  let created;
  for (let attempt = 0; attempt < 5; attempt++) {
    const certificateId = generateCertificateId(year);
    try {
      created = await db.internshipCertificate.create({
        data: {
          certificateId,
          verifyToken,
          internName: data.internName,
          role: data.role,
          team: data.team,
          startDate: data.startDate,
          endDate: data.endDate,
          issueDate: data.issueDate ?? new Date(),
          performance: data.performance,
          organization: data.organization ?? DEFAULT_ORGANIZATION,
          fatherName: data.fatherName,
          rollNumber: data.rollNumber,
          collegeName: data.collegeName,
          course: data.course,
          semester: data.semester,
          signatoryName: data.signatoryName,
          signatoryTitle: data.signatoryTitle,
          status: 'active',
          issuedBy: auth.payload.userId,
          // Explicit null (not absent) so `deletedAt: null` filters match this
          // row — Prisma+MongoDB does NOT match absent fields against `null`.
          deletedAt: null,
        },
      });
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < 4
      ) {
        continue; // regenerate certificateId and retry
      }
      console.error('[superadmin.certificates.create] failed:', err);
      return NextResponse.json(
        { error: 'Failed to issue certificate. Please try again.' },
        { status: 500 }
      );
    }
  }

  if (!created) {
    return NextResponse.json(
      { error: 'Could not allocate a unique certificate id. Please retry.' },
      { status: 500 }
    );
  }

  // Audit only when the superadmin token carries a valid company id — the
  // AuditLog.companyId column is an ObjectId. Fire-and-forget regardless.
  if (isValidObjectId(auth.payload.companyId)) {
    await recordAudit({
      companyId: auth.payload.companyId,
      userId: auth.payload.userId,
      action: 'superadmin.certificate.issue',
      resource: 'InternshipCertificate',
      resourceId: created.id,
      metadata: {
        certificateId: created.certificateId,
        internName: created.internName,
        team: created.team,
      },
      req,
    });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      success: true,
      certificate: created,
      verifyUrl: buildVerifyUrl(origin, created.certificateId, created.verifyToken),
    },
    { status: 201 }
  );
}
