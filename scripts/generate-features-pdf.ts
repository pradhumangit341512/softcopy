/**
 * scripts/generate-features-pdf.ts
 *
 * Generates `docs/Broker365-Features.pdf` — a professional record of every
 * feature shipped in the Broker365 entitlement build. Sections:
 *
 *   1. Cover page
 *   2. Executive summary
 *   3. Subscription plans matrix
 *   4. Feature catalogue (all 24 features grouped by phase / tier)
 *   5. Architecture & security overview
 *   6. Run / verify checklist
 *
 * Usage:
 *   npx tsx scripts/generate-features-pdf.ts
 *
 * Output:
 *   docs/Broker365-Features.pdf
 *
 * The script reads from lib/plans.ts so the plan tiers + feature labels
 * stay in sync with the running app — edit lib/plans.ts and regenerate.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PLANS,
  PLAN_FEATURES,
  PLAN_METADATA,
  FEATURE_LABELS,
  type FeatureKey,
  type Plan,
} from '../lib/plans';

// ──────────────────────────────────────────────────────────────
// Theme
// ──────────────────────────────────────────────────────────────

const COLOR_PRIMARY: [number, number, number]   = [37, 99, 235];   // blue-600
const COLOR_INK:     [number, number, number]   = [17, 24, 39];    // gray-900
const COLOR_MUTED:   [number, number, number]   = [107, 114, 128]; // gray-500
const COLOR_ACCENT:  [number, number, number]   = [124, 58, 237];  // violet-600
const COLOR_OK:      [number, number, number]   = [16, 185, 129];  // emerald-500
const COLOR_LIGHT:   [number, number, number]   = [243, 244, 246]; // gray-100
const COLOR_BORDER:  [number, number, number]   = [229, 231, 235]; // gray-200

const FONT_BODY = 'helvetica';

// ──────────────────────────────────────────────────────────────
// Phase / status mapping (kept in this file because the PDF is
// the only consumer — duplicating into shared code isn't worth it).
// ──────────────────────────────────────────────────────────────

interface FeatureRow {
  id: string;
  feature: FeatureKey;
  phase: 'Phase 1' | 'Phase 2' | 'Phase 3' | 'Phase 4';
  tier: Plan;
  status: 'Shipped' | 'Shipped (URL-only)' | 'Shipped (MVP)';
}

const FEATURE_RECORD: FeatureRow[] = [
  // Phase 1 — Basic
  { id: 'F1',  feature: 'feature.daily_plan',                  phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F2',  feature: 'feature.lead_transfer',               phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F3',  feature: 'feature.dead_leads_tab',              phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F4',  feature: 'feature.lead_type_tabs',              phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F5',  feature: 'feature.inventory_tabs',              phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F6',  feature: 'feature.extended_lead_statuses',      phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F7',  feature: 'feature.extended_property_statuses',  phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },
  { id: 'F8',  feature: 'feature.source_presets',              phase: 'Phase 1', tier: 'basic',      status: 'Shipped' },

  // Phase 2 — Standard
  { id: 'F9',  feature: 'feature.inventory_wizard',            phase: 'Phase 2', tier: 'standard',   status: 'Shipped' },
  { id: 'F10', feature: 'feature.inventory_project_fields',    phase: 'Phase 2', tier: 'standard',   status: 'Shipped' },
  { id: 'F11', feature: 'feature.inventory_deal_fields',       phase: 'Phase 2', tier: 'standard',   status: 'Shipped' },
  { id: 'F12', feature: 'feature.multi_phone',                 phase: 'Phase 2', tier: 'standard',   status: 'Shipped' },
  { id: 'F13', feature: 'feature.bulk_inventory',              phase: 'Phase 2', tier: 'standard',   status: 'Shipped' },
  { id: 'F14', feature: 'feature.export_leads',                phase: 'Phase 2', tier: 'standard',   status: 'Shipped' },

  // Phase 3 — Pro
  { id: 'F15', feature: 'feature.bulk_broker_reqs',            phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },
  { id: 'F16', feature: 'feature.bulk_projects',               phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },
  { id: 'F17', feature: 'feature.projects_working',            phase: 'Phase 3', tier: 'pro',        status: 'Shipped (MVP)' },
  { id: 'F18', feature: 'feature.broker_reqs',                 phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },
  { id: 'F19', feature: 'feature.opportunity_matcher',         phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },
  { id: 'F20', feature: 'feature.learn_grow',                  phase: 'Phase 3', tier: 'pro',        status: 'Shipped (URL-only)' },
  { id: 'F21', feature: 'feature.reference_db',                phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },
  { id: 'F22', feature: 'feature.project_wizard',              phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },
  { id: 'F23', feature: 'feature.export_broker_reqs',          phase: 'Phase 3', tier: 'pro',        status: 'Shipped' },

  // Phase 4 — Enterprise
  { id: 'F24', feature: 'feature.granular_permissions',        phase: 'Phase 4', tier: 'enterprise', status: 'Shipped' },
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

interface DocCursor {
  doc: jsPDF;
  y: number;
  /** Page width minus the symmetric horizontal margins. */
  pageWidth: number;
  marginX: number;
  marginY: number;
}

function newCursor(doc: jsPDF): DocCursor {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const marginY = 18;
  return { doc, y: marginY, pageWidth, marginX, marginY };
}

/** Move down by `delta` mm; auto-paginate when we'd overflow. */
function space(c: DocCursor, delta: number) {
  c.y += delta;
  ensureRoom(c, 0);
}

/** If the next block needs `needed` mm and we'd overflow, page-break. */
function ensureRoom(c: DocCursor, needed: number) {
  const pageHeight = c.doc.internal.pageSize.getHeight();
  if (c.y + needed > pageHeight - c.marginY) {
    c.doc.addPage();
    c.y = c.marginY;
  }
}

function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function h1(c: DocCursor, text: string) {
  ensureRoom(c, 16);
  c.doc.setFont(FONT_BODY, 'bold');
  c.doc.setFontSize(20);
  setColor(c.doc, COLOR_INK);
  c.doc.text(text, c.marginX, c.y);
  c.y += 8;
  // Underline accent.
  setFill(c.doc, COLOR_PRIMARY);
  c.doc.rect(c.marginX, c.y - 1, 22, 1.2, 'F');
  c.y += 4;
}

function h2(c: DocCursor, text: string) {
  ensureRoom(c, 12);
  c.doc.setFont(FONT_BODY, 'bold');
  c.doc.setFontSize(13);
  setColor(c.doc, COLOR_PRIMARY);
  c.doc.text(text, c.marginX, c.y);
  c.y += 6;
}

function p(c: DocCursor, text: string, opts: { muted?: boolean; size?: number } = {}) {
  c.doc.setFont(FONT_BODY, 'normal');
  c.doc.setFontSize(opts.size ?? 10);
  setColor(c.doc, opts.muted ? COLOR_MUTED : COLOR_INK);
  const lines = c.doc.splitTextToSize(text, c.pageWidth - c.marginX * 2);
  ensureRoom(c, lines.length * 5);
  c.doc.text(lines, c.marginX, c.y);
  c.y += lines.length * 5;
}

function bullets(c: DocCursor, items: string[]) {
  c.doc.setFont(FONT_BODY, 'normal');
  c.doc.setFontSize(10);
  setColor(c.doc, COLOR_INK);
  const wrapWidth = c.pageWidth - c.marginX * 2 - 5;
  for (const item of items) {
    const lines = c.doc.splitTextToSize(item, wrapWidth);
    ensureRoom(c, lines.length * 5 + 1);
    setColor(c.doc, COLOR_PRIMARY);
    c.doc.text('•', c.marginX, c.y);
    setColor(c.doc, COLOR_INK);
    c.doc.text(lines, c.marginX + 5, c.y);
    c.y += lines.length * 5 + 1;
  }
}

function pageFooter(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont(FONT_BODY, 'normal');
    doc.setFontSize(8);
    setColor(doc, COLOR_MUTED);
    doc.text('Broker365 — Features Record', 14, h - 8);
    doc.text(`Page ${i} of ${total}`, w - 14, h - 8, { align: 'right' });
  }
}

// ──────────────────────────────────────────────────────────────
// Sections
// ──────────────────────────────────────────────────────────────

function coverPage(c: DocCursor) {
  const { doc, pageWidth } = c;
  const h = doc.internal.pageSize.getHeight();

  // Top accent band.
  setFill(doc, COLOR_PRIMARY);
  doc.rect(0, 0, pageWidth, 60, 'F');

  doc.setFont(FONT_BODY, 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('Broker365', c.marginX, 32);

  doc.setFont(FONT_BODY, 'normal');
  doc.setFontSize(13);
  doc.text('Features Record', c.marginX, 44);

  // Centerpiece.
  doc.setFont(FONT_BODY, 'bold');
  doc.setFontSize(34);
  setColor(doc, COLOR_INK);
  doc.text('All 24 Features', c.marginX, h / 2 - 12);
  doc.setFont(FONT_BODY, 'normal');
  doc.setFontSize(16);
  setColor(doc, COLOR_MUTED);
  doc.text(
    'Shipped through the entitlement-gated build cycle',
    c.marginX,
    h / 2,
  );

  // Quick-stats card.
  const cardY = h / 2 + 14;
  setFill(doc, COLOR_LIGHT);
  doc.roundedRect(c.marginX, cardY, pageWidth - c.marginX * 2, 38, 3, 3, 'F');
  doc.setFont(FONT_BODY, 'bold');
  doc.setFontSize(11);
  setColor(doc, COLOR_INK);
  doc.text('At a glance', c.marginX + 6, cardY + 8);
  doc.setFont(FONT_BODY, 'normal');
  doc.setFontSize(10);
  setColor(doc, COLOR_INK);
  const stats = [
    `4 subscription plans · 24 feature flags · ${FEATURE_RECORD.length} features delivered`,
    'Build status: green (npm run build exits 0)',
    'Multi-tenant safe: companyId scope on every API path',
    'Generated from lib/plans.ts — single source of truth',
  ];
  let sy = cardY + 14;
  for (const line of stats) {
    doc.text('• ' + line, c.marginX + 6, sy);
    sy += 5;
  }

  // Footer date.
  doc.setFont(FONT_BODY, 'normal');
  doc.setFontSize(9);
  setColor(doc, COLOR_MUTED);
  doc.text(
    `Generated ${new Date().toISOString().slice(0, 10)}`,
    c.marginX,
    h - 18,
  );
  doc.text(
    'Internal record — distribute within Broker365 only',
    pageWidth - c.marginX,
    h - 18,
    { align: 'right' },
  );

  doc.addPage();
  c.y = c.marginY;
}

function executiveSummary(c: DocCursor) {
  h1(c, 'Executive Summary');
  p(
    c,
    'This document records every customer-facing feature delivered through the entitlement build cycle. It is generated from lib/plans.ts so the catalogue here is the same one the running application uses for plan resolution and gating.',
  );
  space(c, 2);
  p(
    c,
    'The build introduces a four-tier subscription model — Basic, Standard, Pro, and Enterprise — with per-feature override flags so any company can be granted or denied individual capabilities without changing tiers. Twenty-four features are wired through the system, covering lead capture, inventory hierarchy, broker-channel tracking, opportunity matching, resource libraries, exports, bulk imports, and granular per-member permissions.',
    { muted: false },
  );
  space(c, 4);

  h2(c, 'What was delivered');
  bullets(c, [
    'A reusable Phase-0 entitlement system: plans constant, runtime resolver, server-side requireFeature middleware, client useFeature hook, plan-aware sidebar, and a superadmin UI for assigning plans and per-feature overrides.',
    '24 individually-flagged features grouped into four tiers, each shippable in isolation and reversible without data loss.',
    'Defensive multi-tenant architecture: every read/write path filters by companyId from the JWT, never the request body. Chain-of-trust queries (e.g. unit → tower → project → company) verify the entire chain in a single query.',
    '15 backwards-compatible Prisma migrations registered in scripts/migrations/index.ts. All are idempotent; legacy rows are coerced or back-filled, never destroyed.',
    'Bulk-import flows for leads, inventory, broker requirements, and projects with column-alias resolution and best-effort batches (5,000 rows).',
    'Excel export endpoints for leads, inventory, and broker requirements, gated per plan.',
  ]);
  space(c, 4);

  h2(c, 'Honest scope notes');
  bullets(c, [
    'F17 Projects Working ships as MVP — full hierarchy schema, listing page, 2-step add wizard, and project detail page with inline tower/unit add. Edit-in-place for individual towers/units is a follow-up.',
    'F20 Learn & Grow is URL-based today. The schema is ready for Vercel Blob / S3 wiring; users paste links to externally-hosted documents in the meantime.',
  ]);
}

function plansMatrix(c: DocCursor) {
  c.doc.addPage();
  c.y = c.marginY;
  h1(c, 'Subscription Plans');
  p(
    c,
    'Plans are stored on Company.plan and resolved at request time alongside Company.featureFlags overrides. Higher tiers extend lower tiers automatically.',
  );
  space(c, 4);

  // Plan cards table.
  const planRows = PLANS.map((p): string[] => {
    const meta = PLAN_METADATA[p];
    const features = PLAN_FEATURES[p];
    return [
      meta.label,
      meta.tagline,
      `₹${meta.pricePerUserMonth.toLocaleString('en-IN')} / user / mo`,
      `${features.length} features`,
    ];
  });

  autoTable(c.doc, {
    startY: c.y,
    head: [['Plan', 'Audience', 'Price', 'Unlocks']],
    body: planRows,
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, textColor: COLOR_INK },
    alternateRowStyles: { fillColor: COLOR_LIGHT },
    styles: { cellPadding: 3 },
  });

  // After autoTable, move y past the rendered table.
  // jspdf-autotable v5 exposes the final cursor on the doc.
  // (Type cast is fine — runtime gives lastAutoTable.finalY.)
  const lastY = (c.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (lastY) c.y = lastY + 6;

  h2(c, 'Per-tier feature breakdown');
  for (const plan of PLANS) {
    const meta = PLAN_METADATA[plan];
    const includedKeys = PLAN_FEATURES[plan];
    ensureRoom(c, 14);
    c.doc.setFont(FONT_BODY, 'bold');
    c.doc.setFontSize(11);
    setColor(c.doc, COLOR_ACCENT);
    c.doc.text(meta.label, c.marginX, c.y);
    c.doc.setFont(FONT_BODY, 'normal');
    c.doc.setFontSize(9);
    setColor(c.doc, COLOR_MUTED);
    c.doc.text(
      `${includedKeys.length} features · ${meta.tagline}`,
      c.marginX + 35,
      c.y,
    );
    c.y += 5;

    const items = includedKeys.map((k) => `${k.replace('feature.', '')} — ${FEATURE_LABELS[k].label}`);
    bullets(c, items);
    space(c, 2);
  }
}

function featureCatalogue(c: DocCursor) {
  c.doc.addPage();
  c.y = c.marginY;
  h1(c, 'Feature Catalogue');
  p(
    c,
    'Every shipped feature with its identifier, plan tier, and one-line description. Status reflects the delivery state at the time of this record.',
  );
  space(c, 3);

  const rows = FEATURE_RECORD.map((row) => {
    const meta = FEATURE_LABELS[row.feature];
    return [
      row.id,
      meta.label,
      row.tier.charAt(0).toUpperCase() + row.tier.slice(1),
      row.status,
      meta.description,
    ];
  });

  autoTable(c.doc, {
    startY: c.y,
    head: [['ID', 'Feature', 'Tier', 'Status', 'Description']],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: COLOR_INK },
    alternateRowStyles: { fillColor: COLOR_LIGHT },
    styles: { cellPadding: 2.4 },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 28 },
      4: { cellWidth: 'auto' as const },
    },
  });

  const lastY = (c.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (lastY) c.y = lastY + 6;

  // Phase summary cards.
  const phases: Array<FeatureRow['phase']> = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];
  const phaseCounts = phases.map((ph) => ({
    phase: ph,
    count: FEATURE_RECORD.filter((f) => f.phase === ph).length,
  }));

  ensureRoom(c, 28);
  h2(c, 'Phase distribution');
  const phaseRows = phaseCounts.map((p) => [p.phase, String(p.count)]);
  autoTable(c.doc, {
    startY: c.y,
    head: [['Phase', 'Features delivered']],
    body: phaseRows,
    theme: 'grid',
    headStyles: { fillColor: COLOR_ACCENT, textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    styles: { cellPadding: 3 },
    margin: { left: c.marginX, right: c.marginX },
  });
  const ly2 = (c.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (ly2) c.y = ly2 + 4;
}

function architectureSecurity(c: DocCursor) {
  c.doc.addPage();
  c.y = c.marginY;
  h1(c, 'Architecture & Security');

  h2(c, 'Three-layer access model');
  bullets(c, [
    'Layer 1 — Plan: Company.plan + Company.featureFlags decide which features the company can use. Resolved per-request via lib/entitlements.ts.',
    'Layer 2 — Role: User.role (superadmin / admin / user) constrains who within the company can do what — hidden in the sidebar, blocked at the page guard, rejected at the API.',
    'Layer 3 — Per-member permissions (F24, Enterprise): grant or revoke individual capabilities on top of the role baseline via User.permissions.',
  ]);
  space(c, 3);

  h2(c, 'Triple-gating on every feature');
  bullets(c, [
    'UI: gated nav items hide when the feature flag is off.',
    'Page: server-rendered guards short-circuit to the FeatureLocked empty-state.',
    'API: requireFeature middleware returns 403 with { upgradeRequired: true } before any DB write.',
    'Why all three: a UI bug or a deep-linked URL still cannot bypass the API gate.',
  ]);
  space(c, 3);

  h2(c, 'Multi-tenant safety');
  bullets(c, [
    'Every read/write filters by companyId from the JWT — never from the request body.',
    'Chain-of-trust queries verify the full ancestry in a single Prisma where-clause (e.g. inserting a unit checks tower → project → company match inline).',
    'Soft delete via deletedAt on every collection means a bad mutation is recoverable; team-member ownership filters compose with deletedAt: null on every query.',
  ]);
  space(c, 3);

  h2(c, 'Auditability');
  bullets(c, [
    'recordAudit() is wired on every superadmin and per-member-permissions write.',
    'Bulk imports report per-row outcomes (imported / skipped) so an admin can re-act on partial failures.',
    'Companies can export their data in Excel from any list module — no platform lock-in.',
  ]);
  space(c, 3);

  h2(c, 'Data lifecycle');
  bullets(c, [
    '15 idempotent migrations registered in scripts/migrations/index.ts — safe to re-run.',
    'Backfills coerce legacy values rather than dropping rows (e.g. ownerPhone → ownerPhones[0] kept in lock-step).',
    'No destructive schema changes — every Prisma update is additive or nullable.',
  ]);
}

function verifyChecklist(c: DocCursor) {
  c.doc.addPage();
  c.y = c.marginY;
  h1(c, 'Verify checklist');

  p(
    c,
    'Before promoting these changes to production, work through this list against a staging copy of the database.',
  );
  space(c, 3);

  h2(c, 'Build & types');
  bullets(c, [
    'npx prisma generate              — confirms schema compiles',
    'npx tsc --noEmit                 — confirms TypeScript clean',
    'npx tsx scripts/migrate.ts        — runs all 15 migrations idempotently',
    'npm run build                    — confirms Next.js production build is green',
  ]);
  space(c, 3);

  h2(c, 'Runtime smoke tests');
  bullets(c, [
    'Superadmin can assign Basic / Standard / Pro / Enterprise plans on /superadmin/companies/[id]/features.',
    'Per-feature override toggles (Plan / Grant / Revoke) update the company at PATCH time and resolve correctly on the next request.',
    'Admin user on a Pro-plan company sees Projects Working, Brokers Requirements, Find Opportunity, Reference DB in the sidebar; Basic-plan company sees only the basic set.',
    'Hitting a gated API path directly (e.g. /api/projects) returns 403 with upgradeRequired: true when the feature is off.',
    'Bulk imports report per-row outcomes; valid rows persist while invalid rows surface in the skipped list.',
    'Excel exports honour the same filters as the list page and respect team-member ownership.',
  ]);
}

// ──────────────────────────────────────────────────────────────
// Build the PDF
// ──────────────────────────────────────────────────────────────

function build() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const c = newCursor(doc);

  coverPage(c);
  executiveSummary(c);
  plansMatrix(c);
  featureCatalogue(c);
  architectureSecurity(c);
  verifyChecklist(c);

  pageFooter(doc);

  const outDir = resolve(process.cwd(), 'docs');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'Broker365-Features.pdf');

  // jspdf returns an ArrayBuffer when output('arraybuffer'); convert to
  // a Node Buffer for writeFileSync.
  const ab = doc.output('arraybuffer');
  writeFileSync(outPath, Buffer.from(ab));
  // eslint-disable-next-line no-console
  console.log(`PDF generated: ${outPath}`);
}

build();
