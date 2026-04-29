/**
 * /api/users/teammates
 *
 * GET → list of teammates the caller can hand work over to.
 *
 * Returns active 'admin' + 'user' rows in the caller's company, excluding
 * the caller themselves. Available to any authenticated user (not just
 * admins) so team members can use it to populate the lead-transfer
 * dropdown.
 *
 * Returns minimal fields — no email-versus-business-rule data, no phone,
 * no audit fields — because this endpoint is designed to be safe to expose
 * widely without leaking PII.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teammates = await db.user.findMany({
      where: {
        companyId: payload.companyId,
        deletedAt: null,
        status: 'active',
        role: { in: ['admin', 'user'] },
        NOT: { id: payload.userId },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ teammates });
  } catch (error) {
    console.error('Fetch teammates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teammates' },
      { status: 500 }
    );
  }
}
