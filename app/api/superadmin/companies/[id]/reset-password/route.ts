/**
 * /api/superadmin/companies/[id]/reset-password
 *
 * POST → reset the company's primary admin's password to a new temp password.
 *        Body: { newPassword?: string }  (omit to auto-generate)
 *        Bumps the admin's tokenVersion so any active sessions die.
 *        Returns the temp password ONCE so superadmin can hand it over.
 *
 * Use case: broker forgets password and emails you. You reset it here, send
 * them the temp password via WhatsApp/email, and they log in + change it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidObjectId, hashPassword } from '@/lib/auth';
import { requireSuperAdmin, generateTempPassword } from '@/lib/superadmin';
import { passwordSchema } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';
import { resetLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';

const bodySchema = z.object({
  newPassword: passwordSchema.optional(),
}).strict();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const rl = await resetLimiter.check(10, `sa:reset:${auth.payload.userId}`);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }

  // Body is optional; default to {} so omitting "newPassword" is fine.
  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    // empty body — fall through
  }

  // Find the FIRST admin in this company. If multiple, we reset only one;
  // superadmin can pick a specific user via /api/users/[id] for finer control.
  const admin = await db.user.findFirst({
    where: { companyId: id, role: 'admin', deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true },
  });
  if (!admin) {
    return NextResponse.json(
      { error: 'No admin user found for this company' },
      { status: 404 }
    );
  }

  const newPassword = body.newPassword ?? generateTempPassword();
  const hashed = await hashPassword(newPassword);

  await db.user.update({
    where: { id: admin.id },
    data: {
      password: hashed,
      tokenVersion: { increment: 1 }, // kill all current sessions
    },
  });

  await recordAudit({
    companyId: id,
    userId: auth.payload.userId,
    action: 'superadmin.admin.reset_password',
    resource: 'User',
    resourceId: admin.id,
    metadata: { adminEmail: admin.email },
    req,
  });

  return NextResponse.json({
    success: true,
    admin: { id: admin.id, email: admin.email, name: admin.name },
    tempPassword: newPassword,
    message: 'Password reset. Hand the temp password to the broker — it cannot be retrieved later.',
  });
}
