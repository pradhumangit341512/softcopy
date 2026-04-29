/**
 * POST /api/projects/import — F16
 *
 * Bulk-import projects + towers + units from a flat Excel sheet. Each
 * row is one unit; the server groups rows by (projectName, towerName)
 * and creates the hierarchy in three passes:
 *
 *   1. Distinct projectName → upsert Project (matching by name within
 *      the company; preserves the existing project if found).
 *   2. Distinct (projectId, towerName) → upsert Tower.
 *   3. Each row → create Unit under its tower.
 *
 * Best-effort batch: rows missing required fields are skipped, the rest
 * are imported. 5000-row cap.
 *
 * Feature gate: feature.bulk_projects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireFeature } from '@/lib/require-feature';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;

const rowSchema = z.object({
  projectName: z.string().trim().min(1, 'Project name is required'),
  propertyType: z.enum(['Commercial', 'Residential']).default('Residential'),
  constructionStatus: z.enum(['ReadyToMove', 'UnderConstruction']).default('ReadyToMove'),
  city: z.string().trim().optional().nullable().default(null),
  location: z.string().trim().optional().nullable().default(null),
  sector: z.string().trim().optional().nullable().default(null),
  towerName: z.string().trim().min(1, 'Tower name is required'),
  floor: z.coerce.number().int().min(0).max(200).default(0),
  unitNo: z.string().trim().min(1, 'Unit number is required'),
  ownerName: z.string().trim().optional().nullable().default(null),
  ownerEmail: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => v || null),
  ownerPhones: z
    .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === 'string') {
        return v.split(/[,|;]/).map((s) => s.trim()).filter(Boolean);
      }
      return [];
    }),
  typology: z.string().trim().optional().nullable().default(null),
  size: z.string().trim().optional().nullable().default(null),
  status: z.string().trim().default('Vacant'),
  remarks: z.string().trim().optional().nullable().default(null),
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
    const gate = await requireFeature(payload.companyId, 'feature.bulk_projects');
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

    const skipped: Array<{ row: number; errors: string[] }> = [];
    const validRows: Array<z.infer<typeof rowSchema> & { rowNum: number }> = [];

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
      validRows.push({ ...parsed.data, rowNum });
    }

    // Pass 1 — upsert distinct projects (by name within company).
    const projectIdByName = new Map<string, string>();
    for (const r of validRows) {
      if (projectIdByName.has(r.projectName)) continue;
      const existing = await db.project.findFirst({
        where: { companyId: payload.companyId, name: r.projectName, deletedAt: null },
        select: { id: true },
      });
      const id = existing
        ? existing.id
        : (await db.project.create({
            data: {
              companyId: payload.companyId,
              name: r.projectName,
              propertyType: r.propertyType,
              constructionStatus: r.constructionStatus,
              city: r.city,
              location: r.location,
              sector: r.sector,
              createdBy: payload.userId,
              deletedAt: null,
            },
            select: { id: true },
          })).id;
      projectIdByName.set(r.projectName, id);
    }

    // Pass 2 — upsert distinct towers per (projectId, towerName).
    const towerIdByKey = new Map<string, string>();
    for (const r of validRows) {
      const projectId = projectIdByName.get(r.projectName);
      if (!projectId) continue;
      const key = `${projectId}::${r.towerName}`;
      if (towerIdByKey.has(key)) continue;
      const existing = await db.tower.findFirst({
        where: { projectId, name: r.towerName, deletedAt: null },
        select: { id: true },
      });
      const id = existing
        ? existing.id
        : (await db.tower.create({
            data: { projectId, name: r.towerName, deletedAt: null },
            select: { id: true },
          })).id;
      towerIdByKey.set(key, id);
    }

    // Pass 3 — create units. Best-effort; per-row failures are reported.
    const importedUnits: Array<{ row: number; unitNo: string; id: string }> = [];
    for (const r of validRows) {
      const projectId = projectIdByName.get(r.projectName);
      const towerId = projectId ? towerIdByKey.get(`${projectId}::${r.towerName}`) : undefined;
      if (!towerId) {
        skipped.push({ row: r.rowNum, errors: ['Failed to resolve tower'] });
        continue;
      }
      try {
        const unit = await db.unit.create({
          data: {
            towerId,
            floor: r.floor,
            unitNo: r.unitNo,
            ownerName: r.ownerName,
            ownerEmail: r.ownerEmail,
            ownerPhones: r.ownerPhones ?? [],
            typology: r.typology,
            size: r.size,
            status: r.status,
            remarks: r.remarks,
            deletedAt: null,
          },
          select: { id: true, unitNo: true },
        });
        importedUnits.push({ row: r.rowNum, unitNo: unit.unitNo, id: unit.id });
      } catch (err) {
        console.error(`[projects-import] row ${r.rowNum} failed:`, err);
        skipped.push({ row: r.rowNum, errors: ['Unit insert failed'] });
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedUnits.length,
      skipped: skipped.length,
      total: rows.length,
      projects: projectIdByName.size,
      towers: towerIdByKey.size,
      details: { imported: importedUnits, skipped },
    });
  } catch (err) {
    console.error('Bulk projects import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}
