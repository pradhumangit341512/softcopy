/**
 * POST /api/properties/import — F13
 *
 * Bulk-import inventory rows from a parsed Excel/CSV payload. Mirrors the
 * /api/clients/import shape so the frontend pattern (file → exceljs →
 * { rows } JSON) stays uniform across modules.
 *
 *   - companyId + createdBy stamped from JWT (never from the payload)
 *   - deletedAt: null on every row
 *   - Invalid rows skipped, valid ones still import (best-effort batch)
 *   - Max 5000 rows per request
 *   - Duplicate ownerPhone within the batch flagged
 *   - F12 — ownerPhone & ownerPhones[0] kept in lock-step
 *   - F10/F11 fields are accepted but optional; unknown values pass
 *     through as plain strings (server doesn't enforce a master list).
 *
 * Feature gate: feature.bulk_inventory.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireFeature } from '@/lib/require-feature';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;

const rowSchema = z.object({
  propertyName: z.string().trim().min(1, 'Inventory name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  propertyType: z.string().trim().min(1, 'Property type is required'),
  bhkType: z.string().trim().optional().nullable().default(null),
  area: z.string().trim().optional().nullable().default(null),
  description: z.string().trim().optional().nullable().default(null),
  status: z.string().trim().default('Available'),
  // Numeric — coerce strings, treat blank/NaN as null.
  askingRent: z
    .union([z.coerce.number().nonnegative(), z.literal(''), z.null()])
    .optional()
    .transform((v) =>
      v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v))
        ? null
        : Number(v)
    ),
  sellingPrice: z
    .union([z.coerce.number().nonnegative(), z.literal(''), z.null()])
    .optional()
    .transform((v) =>
      v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v))
        ? null
        : Number(v)
    ),
  vacateDate: z.union([z.string(), z.date()]).optional().nullable().default(null),

  // F10 — project identity
  projectName: z.string().trim().optional().nullable().default(null),
  sectorNo: z.string().trim().optional().nullable().default(null),
  unitNo: z.string().trim().optional().nullable().default(null),
  towerNo: z.string().trim().optional().nullable().default(null),
  typology: z.string().trim().optional().nullable().default(null),

  // F11 — deal flow
  demand: z
    .union([z.coerce.number().nonnegative(), z.literal(''), z.null()])
    .optional()
    .transform((v) =>
      v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v))
        ? null
        : Number(v)
    ),
  paymentStatus: z.string().trim().optional().nullable().default(null),
  caseType: z.string().trim().optional().nullable().default(null),
  loanStatus: z.string().trim().optional().nullable().default(null),

  // Owner
  ownerName: z.string().trim().min(1, 'Owner name is required'),
  ownerPhone: z.string().trim().min(1, 'Owner phone is required'),
  // F12 — secondary phones, optional. Comma- or pipe-separated in the
  // sheet; the frontend can pass either a string or an array. We split
  // strings here so the UX is forgiving.
  ownerPhones: z
    .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === 'string')
        return v
          .split(/[,|;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      return [];
    }),
  ownerEmail: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => v || null),
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

    const gate = await requireFeature(payload.companyId, 'feature.bulk_inventory');
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

    const imported: Array<{ row: number; propertyName: string; id: string }> = [];
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

      // F12 — merge primary + extras into a deduped list, mirror to ownerPhone.
      const phoneList = Array.from(
        new Set(
          [data.ownerPhone, ...(data.ownerPhones ?? [])]
            .map((p) => p.replace(/[\s\-()]/g, ''))
            .filter(Boolean)
        )
      );
      const primaryPhone = phoneList[0] ?? data.ownerPhone;

      // Within-batch duplicate check on the primary phone.
      if (seenPhones.has(primaryPhone)) {
        skipped.push({ row: rowNum, errors: ['Duplicate primary phone in this file'] });
        continue;
      }
      seenPhones.add(primaryPhone);

      try {
        const property = await db.property.create({
          data: {
            propertyName: data.propertyName,
            address: data.address,
            propertyType: data.propertyType,
            bhkType: data.bhkType,
            area: data.area,
            description: data.description,
            status: data.status || 'Available',
            askingRent: data.askingRent ?? null,
            sellingPrice: data.sellingPrice ?? null,
            vacateDate: data.vacateDate ? new Date(data.vacateDate) : null,
            projectName: data.projectName,
            sectorNo: data.sectorNo,
            unitNo: data.unitNo,
            towerNo: data.towerNo,
            typology: data.typology,
            demand: data.demand ?? null,
            paymentStatus: data.paymentStatus,
            caseType: data.caseType,
            loanStatus: data.loanStatus,
            ownerName: data.ownerName,
            ownerPhone: primaryPhone,
            ownerPhones: phoneList,
            ownerEmail: data.ownerEmail,
            companyId: payload.companyId,
            createdBy: payload.userId,
            deletedAt: null,
          },
          select: { id: true, propertyName: true },
        });
        imported.push({ row: rowNum, propertyName: property.propertyName, id: property.id });
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') {
          skipped.push({ row: rowNum, errors: ['Inventory with this data already exists'] });
        } else {
          console.error(`[inventory-import] row ${rowNum} failed:`, err);
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
    console.error('Bulk inventory import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
