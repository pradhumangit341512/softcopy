/**
 * /api/superadmin/certificates/[id]
 *
 * GET    → fetch a single certificate (full row, incl. verifyToken so the
 *          superadmin UI can render the QR / verify link).
 * PATCH  → edit fields, or revoke/reinstate via { status }.
 * DELETE → soft-delete (sets deletedAt). Keeps the row for audit history.
 *
 * Superadmin-only, gated in middleware and re-checked here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidObjectId } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/superadmin';
import { updateCertificateSchema, parseBody } from '@/lib/validations';
import { buildVerifyUrl } from '@/lib/certificates';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const certificate = await db.internshipCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!certificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    certificate,
    verifyUrl: buildVerifyUrl(origin, certificate.certificateId, certificate.verifyToken),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const existing = await db.internshipCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  const parsed = await parseBody(req, updateCertificateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  // Cross-field guard when only one of the two dates is being changed.
  const nextStart = data.startDate ?? existing.startDate;
  const nextEnd = data.endDate ?? existing.endDate;
  if (nextEnd.getTime() < nextStart.getTime()) {
    return NextResponse.json(
      { error: 'End date must be on or after the start date' },
      { status: 400 }
    );
  }

  const updated = await db.internshipCertificate.update({
    where: { id },
    data: {
      ...(data.internName !== undefined && { internName: data.internName }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.team !== undefined && { team: data.team }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.issueDate !== undefined && { issueDate: data.issueDate }),
      ...(data.performance !== undefined && { performance: data.performance }),
      ...(data.organization !== undefined && { organization: data.organization }),
      ...(data.fatherName !== undefined && { fatherName: data.fatherName }),
      ...(data.rollNumber !== undefined && { rollNumber: data.rollNumber }),
      ...(data.collegeName !== undefined && { collegeName: data.collegeName }),
      ...(data.course !== undefined && { course: data.course }),
      ...(data.semester !== undefined && { semester: data.semester }),
      ...(data.signatoryName !== undefined && { signatoryName: data.signatoryName }),
      ...(data.signatoryTitle !== undefined && { signatoryTitle: data.signatoryTitle }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  if (isValidObjectId(auth.payload.companyId)) {
    await recordAudit({
      companyId: auth.payload.companyId,
      userId: auth.payload.userId,
      action:
        data.status && data.status !== existing.status
          ? `superadmin.certificate.${data.status === 'revoked' ? 'revoke' : 'reinstate'}`
          : 'superadmin.certificate.update',
      resource: 'InternshipCertificate',
      resourceId: updated.id,
      metadata: { certificateId: updated.certificateId },
      req,
    });
  }

  return NextResponse.json({ success: true, certificate: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const existing = await db.internshipCertificate.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, certificateId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  await db.internshipCertificate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  if (isValidObjectId(auth.payload.companyId)) {
    await recordAudit({
      companyId: auth.payload.companyId,
      userId: auth.payload.userId,
      action: 'superadmin.certificate.delete',
      resource: 'InternshipCertificate',
      resourceId: existing.id,
      metadata: { certificateId: existing.certificateId },
      req,
    });
  }

  return NextResponse.json({ success: true });
}
