/**
 * Server-side helpers for internship certificates: id/token generation and
 * the public serializer used by the verification page.
 *
 * The public verify view must never leak the `verifyToken` (it's the shared
 * secret in the QR link) or internal ids — `toPublicCertificate` is the single
 * chokepoint that decides what an unauthenticated visitor is allowed to see.
 */

import { randomInt, randomBytes } from 'node:crypto';
import type { InternshipCertificate } from '@prisma/client';

// Unambiguous alphabet — no 0/O/1/I so a certificate id read off a printout
// can't be mistyped into the verify URL.
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Human-readable public id, e.g. "INTERN-2026-K7P2QX". Not guaranteed unique on
 * its own — callers must handle the (astronomically unlikely) unique-index
 * collision by regenerating. ~1.07e9 combinations per year.
 */
export function generateCertificateId(year: number): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return `INTERN-${year}-${suffix}`;
}

/** Unguessable secret embedded in the QR verification link. */
export function generateVerifyToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface PublicCertificate {
  certificateId: string;
  internName: string;
  role: string;
  team: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  performance: string | null;
  organization: string;
  // Optional student details.
  fatherName: string | null;
  rollNumber: string | null;
  collegeName: string | null;
  course: string | null;
  semester: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  status: 'active' | 'revoked';
}

/**
 * Project a certificate row down to the fields safe for public display.
 * Deliberately omits `verifyToken`, `issuedBy`, `id`, and audit timestamps.
 */
export function toPublicCertificate(c: InternshipCertificate): PublicCertificate {
  return {
    certificateId: c.certificateId,
    internName: c.internName,
    role: c.role,
    team: c.team,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    issueDate: c.issueDate.toISOString(),
    performance: c.performance,
    organization: c.organization,
    fatherName: c.fatherName,
    rollNumber: c.rollNumber,
    collegeName: c.collegeName,
    course: c.course,
    semester: c.semester,
    signatoryName: c.signatoryName,
    signatoryTitle: c.signatoryTitle,
    status: c.status,
  };
}

/**
 * Build the absolute verification URL encoded into the QR code. Callers pass
 * the request origin so the same code works in dev, preview, and production.
 */
export function buildVerifyUrl(origin: string, certificateId: string, token: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/verify/${encodeURIComponent(certificateId)}?t=${encodeURIComponent(token)}`;
}
