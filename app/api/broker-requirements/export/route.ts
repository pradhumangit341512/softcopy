/**
 * GET /api/broker-requirements/export — F23
 *
 * Excel export of broker requirements honouring the same filters the
 * list page uses (status, search, date range). Tenant-scoped + role-aware
 * (team members see only their own captured rows; admins see all).
 *
 * Feature gate: feature.export_broker_reqs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.export_broker_reqs');
    if (!gate.ok) return gate.response;

    const sp = req.nextUrl.searchParams;
    const status = sp.get('status') || '';
    const search = sp.get('search') || '';
    const dateFrom = sp.get('dateFrom') || '';
    const dateTo = sp.get('dateTo') || '';

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { brokerName: { contains: search, mode: 'insensitive' } },
        { brokerCompany: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search } },
        { requirement: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const rows = await db.brokerRequirement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Broker Requirements');
    ws.columns = [
      { header: 'Broker Name',     key: 'brokerName',    width: 22 },
      { header: 'Company',         key: 'brokerCompany', width: 20 },
      { header: 'Contact',         key: 'contact',       width: 16 },
      { header: 'Email',           key: 'email',         width: 24 },
      { header: 'Status',          key: 'status',        width: 10 },
      { header: 'Requirement',     key: 'requirement',   width: 40 },
      { header: 'Source',          key: 'source',        width: 14 },
      { header: 'Follow Up',       key: 'followUpDate',  width: 14 },
      { header: 'Remark',          key: 'remark',        width: 30 },
      { header: 'Captured At',     key: 'createdAt',     width: 16 },
    ];
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });
    for (const r of rows) {
      ws.addRow({
        brokerName: r.brokerName,
        brokerCompany: r.brokerCompany ?? '',
        contact: r.contact,
        email: r.email ?? '',
        status: r.status,
        requirement: r.requirement,
        source: r.source ?? '',
        followUpDate: r.followUpDate ? new Date(r.followUpDate).toISOString().slice(0, 10) : '',
        remark: r.remark ?? '',
        createdAt: r.createdAt.toISOString().slice(0, 10),
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="broker-requirements.xlsx"',
      },
    });
  } catch (err) {
    console.error('Export broker-requirements error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
