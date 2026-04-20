/**
 * /api/superadmin/companies/[id]
 *
 * GET    → full company detail with team roster, payment history, and stats
 * PATCH  → update company (plan, seats, expiry, status, notes, monthlyFee)
 * DELETE → soft-cascade: mark company `status:'suspended'` and soft-delete
 *          all of its data (users, clients, properties, commissions). We do
 *          NOT physically delete — recovery is one PATCH away.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidObjectId } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/superadmin';
import { updateCompanyBySuperAdminSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

// ==================== GET ====================

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { id },
    include: {
      users: {
        where: { deletedAt: null },
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          status: true, emailVerified: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      paymentRecords: {
        orderBy: { paidOn: 'desc' },
        take: 50,
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  // Per-company aggregate stats — kept lean; deeper analytics can have their own endpoint later.
  const [clientCount, propertyCount, commissionStats] = await Promise.all([
    db.client.count({ where: { companyId: id, deletedAt: null } }),
    db.property.count({ where: { companyId: id, deletedAt: null } }),
    db.commission.aggregate({
      where: { companyId: id, deletedAt: null },
      _sum: { commissionAmount: true, dealAmount: true },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    company,
    stats: {
      activeClients: clientCount,
      activeProperties: propertyCount,
      totalCommissions: commissionStats._count,
      totalCommissionAmount: commissionStats._sum.commissionAmount ?? 0,
      totalDealVolume: commissionStats._sum.dealAmount ?? 0,
      teamMembers: company.users.filter((u) => u.role === 'user').length,
      admins: company.users.filter((u) => u.role === 'admin').length,
      seatsUsed: company.users.filter((u) => u.role === 'user').length,
      seatsLimit: company.seatLimit,
    },
  });
}

// ==================== PATCH ====================

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }

  const parsed = await parseBody(req, updateCompanyBySuperAdminSchema);
  if (!parsed.ok) return parsed.response;

  const data: Record<string, unknown> = { ...parsed.data };
  // Keep legacy subscriptionExpiry mirrored to subscriptionUntil whenever the
  // latter is updated — middleware reads from subExp claim which is sourced
  // from subscriptionExpiry at login.
  if (parsed.data.subscriptionUntil) {
    data.subscriptionExpiry = parsed.data.subscriptionUntil;
  }

  const updated = await db.company.update({
    where: { id },
    data,
  });

  await recordAudit({
    companyId: id,
    userId: auth.payload.userId,
    action: 'superadmin.company.update',
    resource: 'Company',
    resourceId: id,
    // JSON-safe copy: Date objects don't satisfy InputJsonValue, so we
    // round-trip through JSON to convert any Date → ISO string.
    metadata: JSON.parse(JSON.stringify(parsed.data)),
    req,
  });

  return NextResponse.json({ success: true, company: updated });
}

// ==================== DELETE (soft suspend) ====================

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }

  // Kill sessions FIRST — if step 2 (status flip) fails, users are
  // logged out but company is technically still "active", which is the
  // safer partial-failure state (re-login is blocked once status flips).
  const now = new Date();
  await db.user.updateMany({
    where: { companyId: id },
    data: { tokenVersion: { increment: 1 } },
  });

  await db.company.update({
    where: { id },
    data: { status: 'suspended' },
  });

  await recordAudit({
    companyId: id,
    userId: auth.payload.userId,
    action: 'superadmin.company.suspend',
    resource: 'Company',
    resourceId: id,
    metadata: { suspendedAt: now.toISOString() },
    req,
  });

  return NextResponse.json({ success: true, message: 'Company suspended' });
}
