/**
 * POST /api/cron/weekly-report
 *
 * Runs daily at 9 AM IST via Vercel Cron. On Mondays, sends weekly team
 * report to every admin in every active company. On other days, returns early.
 *
 * Protected by CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Auth: require a valid CRON_SECRET. Vercel's cron runner sends
    // `Authorization: Bearer <CRON_SECRET>` when you configure one in
    // project settings, so we accept either the `x-cron-secret` header
    // or the Bearer form. The previous version of this check had an
    // empty `if` body, which meant any anonymous POST would run the
    // job and spam weekly-report emails.
    if (process.env.CRON_SECRET) {
      const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization');
      const ok =
        secret === process.env.CRON_SECRET ||
        secret === `Bearer ${process.env.CRON_SECRET}`;
      if (!ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Day-of-week check: only run on Monday (IST)
    const now = new Date();
    const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0);
    const istDay = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getDay();

    if (istDay !== 1) {
      return NextResponse.json({ skipped: true, reason: 'Not Monday (IST)', istDay });
    }

    // Get all active companies with their admins
    const companies = await db.company.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        companyName: true,
        users: {
          where: { role: 'admin', status: 'active', deletedAt: null },
          select: { id: true, name: true, email: true },
        },
      },
    });

    let sent = 0;
    let failed = 0;
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const company of companies) {
      if (company.users.length === 0) continue;

      // Get team data for this company
      const teamMembers = await db.user.findMany({
        where: { companyId: company.id, status: 'active', deletedAt: null },
        select: { id: true, name: true, role: true },
      });

      // Per-member stats
      const memberStats = await Promise.all(
        teamMembers.map(async (member) => {
          const [newLeads, dealsClosed, overdueCount, lastSession] = await Promise.all([
            db.client.count({
              where: { createdBy: member.id, companyId: company.id, deletedAt: null, createdAt: { gte: weekAgo } },
            }),
            db.client.count({
              where: { createdBy: member.id, companyId: company.id, deletedAt: null, status: 'DealDone', updatedAt: { gte: weekAgo } },
            }),
            db.client.count({
              where: {
                createdBy: member.id, companyId: company.id, deletedAt: null,
                followUpDate: { lt: now },
                status: { notIn: ['DealDone', 'Rejected'] },
              },
            }),
            db.userSession.findFirst({
              where: { userId: member.id },
              orderBy: { loginAt: 'desc' },
              select: { loginAt: true },
            }),
          ]);

          return {
            name: member.name,
            role: member.role,
            newLeads,
            dealsClosed,
            overdueCount,
            lastLogin: lastSession?.loginAt ?? null,
          };
        })
      );

      // Company-wide stats
      const [totalNewClients, totalDeals, totalDealValue] = await Promise.all([
        db.client.count({ where: { companyId: company.id, deletedAt: null, createdAt: { gte: weekAgo } } }),
        db.client.count({ where: { companyId: company.id, deletedAt: null, status: 'DealDone', updatedAt: { gte: weekAgo } } }),
        db.commission.aggregate({
          where: { companyId: company.id, deletedAt: null, createdAt: { gte: weekAgo } },
          _sum: { dealAmount: true },
        }),
      ]);

      // Build email body (plain text — works everywhere)
      const teamLines = memberStats
        .map((m) => {
          const overdueFlag = m.overdueCount > 3 ? ' ⚠️' : m.overdueCount === 0 ? ' ✅' : '';
          const lastLoginStr = m.lastLogin
            ? new Date(m.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : 'Never';
          return `  ${m.name} (${m.role}) — ${m.newLeads} leads, ${m.dealsClosed} deals, ${m.overdueCount} overdue${overdueFlag} — Last login: ${lastLoginStr}`;
        })
        .join('\n');

      const issues = memberStats
        .filter((m) => m.overdueCount > 3 || (m.lastLogin && Date.now() - new Date(m.lastLogin).getTime() > 2 * 86400000))
        .map((m) => {
          const problems: string[] = [];
          if (m.overdueCount > 3) problems.push(`${m.overdueCount} overdue follow-ups`);
          if (m.lastLogin && Date.now() - new Date(m.lastLogin).getTime() > 2 * 86400000) {
            problems.push('inactive > 2 days');
          }
          return `  🔴 ${m.name}: ${problems.join(', ')}`;
        })
        .join('\n');

      const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const dealValueStr = (totalDealValue._sum.dealAmount ?? 0).toLocaleString('en-IN');

      const emailBody = `📊 Weekly Team Report — ${dateStr}
${company.companyName}

━━━ Team Overview ━━━
${teamLines || '  No active team members'}

━━━ This Week ━━━
  • ${totalNewClients} new clients added
  • ${totalDeals} deals closed (₹${dealValueStr} total)

${issues ? `━━━ Needs Attention ━━━\n${issues}` : '  ✅ No issues — team is on track!'}

—
Sent by RealEstate CRM`;

      // Send to each admin
      for (const admin of company.users) {
        try {
          // Use Resend if available, otherwise log only
          if (process.env.RESEND_API_KEY) {
            const { Resend } = await import('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: 'CRM Reports <onboarding@resend.dev>',
              to: admin.email,
              subject: `📊 Weekly Team Report — ${dateStr}`,
              text: emailBody,
            });
          }

          await db.emailLog.create({
            data: {
              recipientUserId: admin.id,
              recipientEmail: admin.email,
              emailType: 'weekly_report',
              status: 'sent',
            },
          });
          sent++;
        } catch (err) {
          await db.emailLog.create({
            data: {
              recipientUserId: admin.id,
              recipientEmail: admin.email,
              emailType: 'weekly_report',
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            },
          }).catch(() => {});
          failed++;
        }
      }
    }

    console.log(`[weekly-report] sent: ${sent}, failed: ${failed}`);
    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    console.error('[weekly-report] error:', error);
    return NextResponse.json({ error: 'Report failed' }, { status: 500 });
  }
}
