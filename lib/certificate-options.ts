/**
 * Shared vocabulary + text builders for Broker365 company internship
 * certificates.
 *
 * Pure TypeScript (no React, no browser/Node-only APIs) so it is safe to import
 * from server routes (Zod validation, the public verify page) AND client
 * components (create form, on-screen preview, PDF builder). Keeping the brand,
 * fixed copy, and the body builder here means the on-screen document, the PDF,
 * and the verify page can never drift apart.
 */

import type { PublicCertificate } from './certificates';

// ── Brand ──
export const BRAND_NAME = 'Broker365';
export const BRAND_TAGLINE = 'Internship Program';
export const BRAND_LOGO_URL = '/logo.svg';
export const DEFAULT_ORGANIZATION = BRAND_NAME;

// Brand palette (hex) — shared by the on-screen doc and the PDF renderer.
export const BRAND_BLUE = '#2d5cff';
export const BRAND_DARK = '#1a3bd1';
export const BRAND_GOLD = '#b08d3e';

// ── Teams ──
export const TEAMS = [
  'Sales',
  'Marketing',
  'Operations',
  'HR',
  'Tech / Development',
  'Finance',
  'Design',
  'Customer Support',
  'Other',
] as const;
export type Team = (typeof TEAMS)[number];
export const OTHER_TEAM = 'Other';

// ── Fixed copy ──
export const CERTIFICATE_TITLE = 'Certificate of Internship';
export const INTRO_LINE = 'This certificate is proudly presented to';

// Seal text.
export const SEAL_TOP_TEXT = `${BRAND_NAME} · INTERNSHIP`;
export const SEAL_CENTER_TEXT = 'VERIFIED';

/** Format an ISO date string as e.g. "8 Sep 2026". Empty string on bad input. */
export function formatCertDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A run of certificate body text; `bold` values are the "filled-in" fields. */
export interface CertSegment {
  text: string;
  bold?: boolean;
}

/**
 * Build the recognition paragraph as a segment array. Both the PDF and the
 * on-screen document render from this, so wording stays identical everywhere.
 */
export function buildCertificateBody(cert: PublicCertificate): CertSegment[] {
  return [
    { text: 'in recognition of the successful completion of an internship as ' },
    { text: cert.role, bold: true },
    { text: ' in the ' },
    { text: cert.team, bold: true },
    { text: ` team at ` },
    { text: cert.organization, bold: true },
    { text: ', from ' },
    { text: formatCertDate(cert.startDate), bold: true },
    { text: ' to ' },
    { text: formatCertDate(cert.endDate), bold: true },
    {
      text:
        '. Throughout the internship, they demonstrated exceptional ' +
        'professionalism, dedication, and a strong commitment to excellence.',
    },
  ];
}

/** Flatten a segment array to plain text (used by the PDF renderer). */
export function segmentsToText(segments: CertSegment[]): string {
  return segments.map((s) => s.text).join('');
}

/**
 * Label/value rows for an intern's optional student details, in a fixed order.
 * Only present fields are returned, so the block hides itself when empty.
 * Shared by the on-screen document, the PDF, and the verify page.
 */
export function studentDetailRows(cert: PublicCertificate): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (cert.fatherName) rows.push({ label: "Father's Name", value: cert.fatherName });
  if (cert.rollNumber) rows.push({ label: 'Roll No', value: cert.rollNumber });
  if (cert.collegeName) rows.push({ label: 'College', value: cert.collegeName });
  if (cert.course || cert.semester) {
    const value = [cert.course, cert.semester ? `Semester ${cert.semester}` : null]
      .filter(Boolean)
      .join(' · ');
    rows.push({ label: 'Course', value });
  }
  return rows;
}
