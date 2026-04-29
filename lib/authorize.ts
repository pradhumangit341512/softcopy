import { NextResponse } from 'next/server';
import type { AuthTokenPayload } from './auth';

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function isAdminRole(role: string | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.SUPERADMIN;
}

export function isTeamMember(role: string | undefined): boolean {
  return role === ROLES.USER;
}

/**
 * Verify the authenticated caller owns (or is an admin on) a company-scoped row.
 *
 * ⚠️ Callers MUST load the row with `deletedAt: null` (or filter it out) —
 * this helper does not check soft-delete. Accepting a deleted row would
 * grant access to a tombstoned record.
 *
 * Ownership precedence for team members:
 *   1. If row has `ownedBy` set → that's the current owner; only they pass.
 *      (Used by Client after F2 lead-transfer; owner changes over time
 *      but createdBy stays put as the audit anchor.)
 *   2. Else fall back to `createdBy` — covers legacy Client rows where
 *      ownedBy hasn't been backfilled yet, and every other model that
 *      doesn't have an ownedBy concept (Property, Commission, etc.).
 *
 * Returns a ready-to-send error response on failure, or `null` on success.
 */
export function assertCompanyOwnership(
  payload: AuthTokenPayload,
  row: { companyId: string; createdBy?: string | null; ownedBy?: string | null }
): NextResponse | null {
  if (row.companyId !== payload.companyId) {
    return NextResponse.json(
      { error: 'Forbidden — resource belongs to a different company' },
      { status: 403 }
    );
  }

  if (isTeamMember(payload.role)) {
    const ownerField = row.ownedBy ?? row.createdBy ?? null;
    if (ownerField && ownerField !== payload.userId) {
      return NextResponse.json(
        { error: 'Forbidden — not your record' },
        { status: 403 }
      );
    }
  }

  return null;
}

/** Guard for admin-only endpoints (user management, destructive ops). */
export function requireAdmin(payload: AuthTokenPayload): NextResponse | null {
  if (!isAdminRole(payload.role)) {
    return NextResponse.json(
      { error: 'Forbidden — admin access required' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Build a Prisma `where` fragment that scopes a query to the caller's company
 * and (for team members) their own records. Use this on every list + update
 * query so there is no gap between auth check and query execution.
 */
export function scopedWhere(
  payload: AuthTokenPayload,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    companyId: payload.companyId,
    deletedAt: null,
    ...extra,
  };
  if (isTeamMember(payload.role)) where.createdBy = payload.userId;
  return where;
}
