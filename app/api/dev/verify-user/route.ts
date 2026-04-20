/**
 * POST /api/dev/verify-user  { email }
 *
 * DEV-ONLY utility. Marks a user as email-verified + active so you can log
 * in without going through the email-link flow. Useful for accounts
 * created before Option-A rolled out (emailVerified field didn't exist).
 *
 * Triple-gated — returns 404 in any Vercel env AND whenever NODE_ENV != development.
 * There is NO way this route reaches a deployed environment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { parseBody, emailSchema } from '@/lib/validations';

export const runtime = 'nodejs';

const IS_DEV_LOCAL =
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV;

const schema = z.object({ email: emailSchema });

export async function POST(req: NextRequest) {
  if (!IS_DEV_LOCAL) {
    // Return 404 to make the endpoint look nonexistent in prod scans.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  // Find the user first so we can also refresh their company's subscription.
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, companyId: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'No user found with that email', count: 0 },
      { status: 404 }
    );
  }

  // Mark user verified + active, reset tokenVersion if missing.
  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      status: 'active',
    },
  });

  // Push the company's subscription expiry 1 year into the future so local dev
  // doesn't get blocked by the 402 subscription_expired middleware.
  let companyUpdated = false;
  if (user.companyId) {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    await db.company.update({
      where: { id: user.companyId },
      data: {
        subscriptionExpiry: oneYear,
        status: 'active',
      },
    });
    companyUpdated = true;
  }

  return NextResponse.json({
    success: true,
    message: `User ${parsed.data.email} + company updated.`,
    user: { verified: true, status: 'active' },
    company: companyUpdated
      ? { subscriptionExtended: true, validFor: '1 year' }
      : { subscriptionExtended: false, reason: 'user has no company' },
  });
}
