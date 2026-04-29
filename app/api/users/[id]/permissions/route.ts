/**
 * /api/users/[id]/permissions — F24
 *
 * GET   → load the user's per-member permission map plus the current
 *         role baseline + canonical catalogue (so the UI is fully
 *         self-describing without hardcoding the keys).
 * PATCH → write a new override map. Replace-style (not merge) — the
 *         payload is the new full map. Sanitises keys against the
 *         canonical catalogue so a typo can't quietly write garbage.
 *
 * Auth: requires admin role on the same company. Feature gate:
 * feature.granular_permissions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';
import { updateUserPermissionsSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';
import {
  PERMISSION_KEYS,
  PERMISSION_GROUPS,
  ROLE_BASELINES,
  isValidPermissionKey,
  asOverrideMap,
} from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

// ── GET ────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const gate = await requireFeature(payload.companyId, 'feature.granular_permissions');
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      user,
      catalogue: PERMISSION_KEYS,
      groups: PERMISSION_GROUPS,
      baseline: ROLE_BASELINES[user.role] ?? [],
      overrides: asOverrideMap(user.permissions),
    });
  } catch (err) {
    console.error('Get user permissions error:', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

// ── PATCH ──────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const gate = await requireFeature(payload.companyId, 'feature.granular_permissions');
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const parsed = await parseBody(req, updateUserPermissionsSchema);
    if (!parsed.ok) return parsed.response;

    // Sanitise — drop unknown keys so a typo doesn't quietly create a dead
    // entry the UI can never display.
    const cleaned: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed.data.permissions)) {
      if (isValidPermissionKey(k)) cleaned[k] = v;
    }

    // Defence in depth: target user must belong to the same company.
    const target = await db.user.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Don't let an admin lock a peer admin or superadmin out of the system.
    if (target.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Cannot modify a superadmin\'s permissions' },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { id },
      data: { permissions: cleaned },
      select: { id: true, permissions: true },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'user.permissions.update',
      resource: 'User',
      resourceId: id,
      metadata: { keys: Object.keys(cleaned).length },
      req,
    });

    return NextResponse.json({ success: true, permissions: updated.permissions });
  } catch (err) {
    console.error('Update user permissions error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
