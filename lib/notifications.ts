/**
 * Notification compute helper.
 *
 * Reads Client records for a user and upserts Notification rows.
 * Idempotent: uses @@unique(userId, clientId, type, dateKey) so
 * calling this multiple times per day produces no duplicates.
 *
 * Called on bell-open (not middleware) to avoid adding DB queries
 * to every request. The bell dropdown triggers compute → then fetches.
 */

import { db } from './db';

function getISTDateKey(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getISTStartOfDay(): Date {
  const key = getISTDateKey();
  const d = new Date(key + 'T00:00:00+05:30');
  return d;
}

function getISTEndOfDay(): Date {
  const key = getISTDateKey();
  const d = new Date(key + 'T23:59:59+05:30');
  return d;
}

export async function computeNotifications(userId: string, companyId: string, role?: string): Promise<void> {
  const dateKey = getISTDateKey();
  const todayStart = getISTStartOfDay();
  const todayEnd = getISTEndOfDay();
  const now = new Date();

  // Fetch this user's active clients with follow-up or visit dates
  const clients = await db.client.findMany({
    where: { createdBy: userId, companyId, deletedAt: null },
    select: {
      id: true,
      clientName: true,
      phone: true,
      followUpDate: true,
      visitingDate: true,
      visitingTime: true,
      preferredLocation: true,
      status: true,
    },
  });

  const upserts: Promise<unknown>[] = [];

  for (const c of clients) {
    if (c.status === 'DealDone' || c.status === 'Rejected') continue;

    // OVERDUE: followUpDate is in the past (before today)
    if (c.followUpDate && new Date(c.followUpDate) < todayStart) {
      const daysLate = Math.floor((now.getTime() - new Date(c.followUpDate).getTime()) / 86400000);
      // Escalate the wording once a lead has rotted 3+ days.
      const message = daysLate >= 3
        ? `⚠️ ${daysLate} days overdue — escalate. Call ${c.phone} now.`
        : `Follow-up was due ${daysLate} day${daysLate > 1 ? 's' : ''} ago. Call ${c.phone} now.`;
      upserts.push(
        db.notification.upsert({
          where: {
            userId_clientId_type_dateKey: { userId, clientId: c.id, type: 'OVERDUE', dateKey },
          },
          create: {
            userId,
            companyId,
            type: 'OVERDUE',
            clientId: c.id,
            title: `Overdue: ${c.clientName}`,
            message,
            severity: 'red',
            dateKey,
          },
          update: { message },
        })
      );
    }

    // DUE_TODAY: followUpDate is today
    if (c.followUpDate) {
      const fd = new Date(c.followUpDate);
      if (fd >= todayStart && fd <= todayEnd) {
        upserts.push(
          db.notification.upsert({
            where: {
              userId_clientId_type_dateKey: { userId, clientId: c.id, type: 'DUE_TODAY', dateKey },
            },
            create: {
              userId,
              companyId,
              type: 'DUE_TODAY',
              clientId: c.id,
              title: `Today: ${c.clientName}`,
              message: `Follow-up due today. Call ${c.phone}.`,
              severity: 'yellow',
              dateKey,
            },
            update: {},
          })
        );
      }
    }

    // VISIT_TODAY: visitingDate is today
    if (c.visitingDate) {
      const vd = new Date(c.visitingDate);
      if (vd >= todayStart && vd <= todayEnd) {
        const timeStr = c.visitingTime ? ` at ${c.visitingTime}` : '';
        const locStr = c.preferredLocation ? ` — ${c.preferredLocation}` : '';
        upserts.push(
          db.notification.upsert({
            where: {
              userId_clientId_type_dateKey: { userId, clientId: c.id, type: 'VISIT_TODAY', dateKey },
            },
            create: {
              userId,
              companyId,
              type: 'VISIT_TODAY',
              clientId: c.id,
              title: `Visit: ${c.clientName}`,
              message: `Site visit${timeStr}${locStr}. Call ${c.phone}.`,
              severity: 'yellow',
              dateKey,
            },
            update: {},
          })
        );
      }
    }
  }

  // ── Manager escalation ──
  // Admins get ONE aggregate alert when leads have rotted 7+ days overdue
  // anywhere in the company (not just their own). `not: null` is required so
  // leads with no follow-up aren't counted (MongoDB null < date).
  if (role === 'admin' || role === 'superadmin') {
    const cutoff = new Date(todayStart);
    cutoff.setDate(cutoff.getDate() - 7);
    const severe = await db.client.count({
      where: {
        companyId,
        deletedAt: null,
        followUpDate: { lt: cutoff, not: null },
        status: { notIn: ['DealDone', 'Rejected'] },
      },
    });
    if (severe > 0) {
      const message = `${severe} lead${severe !== 1 ? 's are' : ' is'} 7+ days overdue across your team. Review the Overdue list.`;
      const title = `${severe} lead${severe !== 1 ? 's' : ''} badly overdue`;
      // Compound-unique can't target clientId:null, so find-then-write keeps
      // this idempotent per admin per day (one aggregate alert).
      const existing = await db.notification.findFirst({
        where: { userId, type: 'ESCALATION', dateKey },
        select: { id: true },
      });
      upserts.push(
        existing
          ? db.notification.update({ where: { id: existing.id }, data: { title, message } })
          : db.notification.create({
              data: { userId, companyId, type: 'ESCALATION', title, message, severity: 'red', dateKey },
            })
      );
    }
  }

  await Promise.allSettled(upserts);
}

/** Create a NEW_ASSIGNMENT notification when admin assigns a client */
export async function createAssignmentNotification(
  userId: string,
  companyId: string,
  clientId: string,
  clientName: string,
  assignedByName: string
): Promise<void> {
  const dateKey = getISTDateKey();
  await db.notification.upsert({
    where: {
      userId_clientId_type_dateKey: { userId, clientId, type: 'NEW_ASSIGNMENT', dateKey },
    },
    create: {
      userId,
      companyId,
      type: 'NEW_ASSIGNMENT',
      clientId,
      title: `New client: ${clientName}`,
      message: `${assignedByName} assigned you a new client.`,
      severity: 'green',
      dateKey,
    },
    update: {},
  }).catch(() => {});
}
