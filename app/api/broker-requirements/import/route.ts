/**
 * POST /api/broker-requirements/import — F15
 *
 * Bulk-import broker requirements from a parsed Excel/CSV payload.
 * Mirrors the F13 inventory bulk-import shape — best-effort batch,
 * per-row Zod, max 5000 rows, in-batch contact dedup.
 *
 * Feature gate: feature.bulk_broker_reqs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireFeature } from '@/lib/require-feature';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;

const rowSchema = z.object({
  brokerName: z.string().trim().min(1, 'Broker name is required'),
  brokerCompany: z.string().trim().optional().nullable().default(null),
  contact: z.string().trim().min(1, 'Contact is required'),
  email: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => v || null),
  status: z.enum(['Hot', 'Ok', 'Visit']).default('Ok'),
  requirement: z.string().trim().min(1, 'Requirement is required'),
  source: z.string().trim().optional().nullable().default(null),
  followUpDate: z.union([z.string(), z.date()]).optional().nullable().default(null),
  remark: z.string().trim().optional().nullable().default(null),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isValidObjectId(payload.companyId) || !isValidObjectId(payload.userId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.bulk_broker_reqs');
    if (!gate.ok) return gate.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { rows } = body as { rows?: unknown[] };
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Body must contain a "rows" array' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ROWS} rows per import. You sent ${rows.length}.` },
        { status: 400 }
      );
    }

    const imported: Array<{ row: number; brokerName: string; id: string }> = [];
    const skipped: Array<{ row: number; errors: string[] }> = [];
    const seenContacts = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const parsed = rowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        skipped.push({
          row: rowNum,
          errors: parsed.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`
          ),
        });
        continue;
      }
      const data = parsed.data;
      const normContact = data.contact.replace(/[\s\-()]/g, '');
      if (seenContacts.has(normContact)) {
        skipped.push({ row: rowNum, errors: ['Duplicate contact in this file'] });
        continue;
      }
      seenContacts.add(normContact);

      try {
        const created = await db.brokerRequirement.create({
          data: {
            brokerName: data.brokerName,
            brokerCompany: data.brokerCompany,
            contact: data.contact,
            email: data.email,
            status: data.status,
            requirement: data.requirement,
            source: data.source,
            followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
            remark: data.remark,
            companyId: payload.companyId,
            createdBy: payload.userId,
            deletedAt: null,
          },
          select: { id: true, brokerName: true },
        });
        imported.push({ row: rowNum, brokerName: created.brokerName, id: created.id });
      } catch (err) {
        console.error(`[broker-req-import] row ${rowNum} failed:`, err);
        skipped.push({ row: rowNum, errors: ['Unexpected error saving this row'] });
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      total: rows.length,
      details: { imported, skipped },
    });
  } catch (err) {
    console.error('Bulk broker-req import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}
