/**
 * POST /api/clients/import
 *
 * Bulk-import clients from a parsed Excel/CSV payload. The frontend reads
 * the file client-side (via exceljs) and sends a JSON array of row objects.
 * Each row is validated against the same Zod schema as single-client create.
 *
 * - companyId + createdBy stamped from JWT (never from the payload)
 * - deletedAt: null explicitly set on every row
 * - Invalid rows are skipped, not rejected — valid ones still import
 * - Max 5000 rows per request
 * - Duplicate phone numbers within the batch are flagged
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;

const rowSchema = z.object({
  clientName: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
  email: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => v || null),
  companyName: z.string().trim().optional().nullable().default(null),
  requirementType: z.string().trim().min(1, 'Requirement type is required'),
  inquiryType: z.string().trim().min(1, 'Inquiry type is required'),
  budget: z
    .union([
      z.coerce.number().positive(),
      z.literal(''),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? null : Number(v))),
  preferredLocation: z.string().trim().optional().nullable().default(null),
  address: z.string().trim().optional().nullable().default(null),
  status: z.string().trim().default('New'),
  source: z.string().trim().optional().nullable().default(null),
  notes: z.string().trim().optional().nullable().default(null),
  followUpDate: z.union([z.string(), z.date()]).optional().nullable().default(null),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

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

    const imported: Array<{ row: number; clientName: string; id: string }> = [];
    const skipped: Array<{ row: number; errors: string[] }> = [];
    const seenPhones = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // Excel row (header is row 1)
      const parsed = rowSchema.safeParse(rows[i]);

      if (!parsed.success) {
        skipped.push({
          row: rowNum,
          errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        });
        continue;
      }

      const data = parsed.data;

      // Duplicate phone check within batch
      const normalizedPhone = data.phone.replace(/[\s\-()]/g, '');
      if (seenPhones.has(normalizedPhone)) {
        skipped.push({ row: rowNum, errors: ['Duplicate phone number in this file'] });
        continue;
      }
      seenPhones.add(normalizedPhone);

      try {
        const client = await db.client.create({
          data: {
            clientName: data.clientName,
            phone: data.phone,
            email: data.email,
            companyName: data.companyName,
            requirementType: data.requirementType,
            inquiryType: data.inquiryType,
            budget: data.budget ? Number(data.budget) : null,
            preferredLocation: data.preferredLocation,
            address: data.address,
            status: data.status || 'New',
            source: data.source,
            notes: data.notes,
            followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
            companyId: payload.companyId,
            createdBy: payload.userId,
            deletedAt: null,
          },
          select: { id: true, clientName: true },
        });
        imported.push({ row: rowNum, clientName: client.clientName, id: client.id });
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') {
          skipped.push({ row: rowNum, errors: ['Client with this data already exists'] });
        } else {
          console.error(`[import] row ${rowNum} failed:`, err);
          skipped.push({ row: rowNum, errors: ['Unexpected error saving this row'] });
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      total: rows.length,
      details: { imported, skipped },
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
