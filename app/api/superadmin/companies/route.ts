/**
 * /api/superadmin/companies
 *
 * GET  → list every broker company in the system, with usage stats and
 *        seat counts. Used by the SuperAdmin dashboard.
 *
 * POST → create a new Company AND its initial admin User in one shot.
 *        This is the ONLY public-facing way new tenants enter the system
 *        (public signup is gone). Returns the temp password so the
 *        superadmin can hand it to the broker out-of-band.
 *
 * Both endpoints are gated to role=superadmin in middleware AND re-checked
 * inside the handler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireSuperAdmin, generateTempPassword } from '@/lib/superadmin';
import { createCompanyWithAdminSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

// ==================== GET — list companies ====================

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));
  const skip = (page - 1) * limit;
  const search = searchParams.get('search') ?? '';
  const statusFilter = searchParams.get('status') ?? '';

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (search) where.companyName = { contains: search, mode: 'insensitive' };

  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        companyName: true,
        logo: true,
        plan: true,
        status: true,
        seatLimit: true,
        monthlyFee: true,
        subscriptionUntil: true,
        subscriptionExpiry: true,
        notes: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            clients: true,
            properties: true,
            commissions: true,
          },
        },
      },
    }),
    db.company.count({ where }),
  ]);

  const now = Date.now();
  const enriched = companies.map((c) => {
    const expiresAt = c.subscriptionUntil ?? c.subscriptionExpiry;
    const daysUntilExpiry = expiresAt
      ? Math.floor((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24))
      : null;
    return {
      ...c,
      daysUntilExpiry,
      isExpired: daysUntilExpiry !== null && daysUntilExpiry < 0,
      expiringSoon: daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 14,
    };
  });

  return NextResponse.json({
    companies: enriched,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ==================== POST — create company + admin ====================

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, createCompanyWithAdminSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  // Reject duplicate admin email/phone BEFORE we create the Company,
  // so we don't end up with an orphan Company on conflict.
  const dupe = await db.user.findFirst({
    where: {
      OR: [{ email: data.adminEmail }, { phone: data.adminPhone }],
    },
    select: { id: true, email: true, phone: true },
  });
  if (dupe) {
    return NextResponse.json(
      {
        error:
          dupe.email === data.adminEmail
            ? 'Admin email already in use by another account'
            : 'Admin phone already in use by another account',
      },
      { status: 409 }
    );
  }

  // Use provided temp password or generate one.
  const tempPassword = data.adminTempPassword ?? generateTempPassword();
  const hashed = await hashPassword(tempPassword);

  // Create Company first, then admin User. Not in a transaction (MongoDB
  // requires replicaset for multi-doc transactions; many Atlas free clusters
  // don't have it). On user-create failure, we explicitly clean up the company.
  const company = await db.company.create({
    data: {
      companyName: data.companyName,
      plan: data.plan,
      seatLimit: data.seatLimit,
      monthlyFee: data.monthlyFee ?? null,
      subscriptionUntil: data.subscriptionUntil,
      subscriptionExpiry: data.subscriptionUntil, // keep legacy field in sync
      notes: data.notes ?? null,
      onboardedBy: auth.payload.userId,
      status: 'active',
    },
  });

  let admin;
  try {
    admin = await db.user.create({
      data: {
        name: data.adminName,
        email: data.adminEmail,
        phone: data.adminPhone,
        password: hashed,
        role: 'admin',
        companyId: company.id,
        emailVerified: new Date(), // pre-verified — superadmin vouched for this account
        deletedAt: null,
        tokenVersion: 0,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  } catch (err) {
    // Clean up the orphan company so a retry can use the same companyName.
    await db.company.delete({ where: { id: company.id } }).catch((cleanupErr) => {
      console.error('[superadmin.companies.create] ORPHAN: company cleanup failed — manual reconciliation needed', {
        companyId: company.id,
        companyName: data.companyName,
        cleanupError: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
    console.error('[superadmin.companies.create] admin create failed:', err);
    return NextResponse.json(
      { error: 'Failed to create admin user; company rolled back.' },
      { status: 500 }
    );
  }

  await recordAudit({
    companyId: company.id,
    userId: auth.payload.userId,
    action: 'superadmin.company.create',
    resource: 'Company',
    resourceId: company.id,
    metadata: { adminUserId: admin.id, adminEmail: admin.email, plan: data.plan, seatLimit: data.seatLimit },
    req,
  });

  return NextResponse.json(
    {
      success: true,
      company,
      admin,
      // Returned ONCE here so the superadmin can hand it to the broker.
      // It's not stored in plain anywhere — only the bcrypt hash lives in DB.
      tempPassword,
    },
    { status: 201 }
  );
}
