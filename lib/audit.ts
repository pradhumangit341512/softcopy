import { db } from './db';
import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { getClientIp } from './rate-limit';

type AuditInput = {
  companyId: string;
  userId: string;
  action: string; // e.g. "user.delete", "auth.password_reset"
  resource: string; // e.g. "User", "Client"
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  req?: NextRequest;
};

/**
 * Write an audit log entry. Fire-and-forget: we never fail a business
 * operation because the audit write failed — but we do log the error so
 * monitoring can alert.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.req ? getClientIp(input.req) : null,
      },
    });
  } catch (err) {
    console.error('AuditLog write failed:', err);
  }
}
