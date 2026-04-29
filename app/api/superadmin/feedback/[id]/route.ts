/**
 * /api/superadmin/feedback/[id] — single-row moderation.
 *
 * PATCH  → flip the row's status (approved / rejected / pending).
 *          Stamps approvedAt + approvedBy when transitioning to 'approved'.
 * DELETE → hard delete a feedback row (used for spam cleanup). Soft
 *          delete isn't useful here because feedback is single-purpose
 *          and recovery is rarely needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidObjectId } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/superadmin';
import { moderateFeedbackSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const parsed = await parseBody(req, moderateFeedbackSchema);
  if (!parsed.ok) return parsed.response;

  const { status } = parsed.data;
  const updated = await db.feedback.update({
    where: { id },
    data: {
      status,
      approvedAt: status === 'approved' ? new Date() : null,
      approvedBy: status === 'approved' ? auth.payload.userId : null,
    },
  });

  await recordAudit({
    // Feedback isn't tenant-scoped; we still log under the superadmin's
    // own company so the audit trail stays per-actor.
    companyId: auth.payload.companyId,
    userId: auth.payload.userId,
    action: `feedback.${status}`,
    resource: 'Feedback',
    resourceId: id,
    metadata: { name: updated.name, rating: updated.rating },
    req,
  });

  return NextResponse.json({ success: true, feedback: updated });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  await db.feedback.delete({ where: { id } });

  await recordAudit({
    companyId: auth.payload.companyId,
    userId: auth.payload.userId,
    action: 'feedback.delete',
    resource: 'Feedback',
    resourceId: id,
    req,
  });

  return NextResponse.json({ success: true });
}
