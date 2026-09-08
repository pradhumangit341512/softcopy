/**
 * Public certificate verification page — the QR-scan target. Reachable without
 * login (whitelisted in middleware). Reads the certificate directly from the
 * DB and confirms authenticity only when the secret `?t=` token matches, so
 * certificate ids alone can't be used to fish for valid records.
 */

import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmt(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function VerifyCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ certificateId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { certificateId } = await params;
  const { t } = await searchParams;

  const cert = await db.internshipCertificate.findFirst({
    where: { certificateId: decodeURIComponent(certificateId), deletedAt: null },
  });

  // Not found, or the QR secret doesn't match → treat as unverifiable. We use
  // the same "invalid" outcome for both so a wrong token can't distinguish
  // "exists but wrong token" from "doesn't exist".
  const tokenOk = !!cert && !!t && t === cert.verifyToken;
  const valid = tokenOk && cert.status === 'active';
  const revoked = tokenOk && cert!.status === 'revoked';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2 text-slate-700">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-semibold">Certificate Verification</span>
        </div>

        {valid && cert ? (
          <div className="overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-green-600 px-6 py-4 text-white">
              <ShieldCheck className="h-7 w-7" />
              <div>
                <p className="text-lg font-semibold">Verified &amp; Authentic</p>
                <p className="text-sm text-green-100">
                  This is a genuine certificate issued by {cert.organization}.
                </p>
              </div>
            </div>
            <dl className="divide-y divide-gray-100 px-6 py-4 text-sm">
              <Row label="Intern" value={cert.internName} strong />
              {cert.fatherName && <Row label="Father's Name" value={cert.fatherName} />}
              {cert.rollNumber && <Row label="Roll No" value={cert.rollNumber} />}
              {cert.collegeName && <Row label="College" value={cert.collegeName} />}
              {(cert.course || cert.semester) && (
                <Row
                  label="Course"
                  value={[cert.course, cert.semester ? `Semester ${cert.semester}` : null].filter(Boolean).join(' · ')}
                />
              )}
              <Row label="Role" value={cert.role} />
              <Row label="Team" value={cert.team} />
              <Row label="Organization" value={cert.organization} />
              <Row label="Duration" value={`${fmt(cert.startDate)} — ${fmt(cert.endDate)}`} />
              <Row label="Issued on" value={fmt(cert.issueDate)} />
              <Row label="Certificate ID" value={cert.certificateId} mono />
              {cert.signatoryName && (
                <Row
                  label="Signed by"
                  value={`${cert.signatoryName}${cert.signatoryTitle ? ` · ${cert.signatoryTitle}` : ''}`}
                />
              )}
            </dl>
            {cert.performance && (
              <p className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-sm italic text-gray-600">
                “{cert.performance}”
              </p>
            )}
          </div>
        ) : revoked && cert ? (
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-amber-500 px-6 py-4 text-white">
              <ShieldAlert className="h-7 w-7" />
              <div>
                <p className="text-lg font-semibold">Certificate Revoked</p>
                <p className="text-sm text-amber-50">
                  This certificate ({cert.certificateId}) was issued but has since been revoked and is no longer valid.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-red-600 px-6 py-4 text-white">
              <ShieldX className="h-7 w-7" />
              <div>
                <p className="text-lg font-semibold">Could Not Verify</p>
                <p className="text-sm text-red-100">
                  This certificate could not be verified. The link may be incomplete or the
                  certificate may not exist. Please scan the QR code again from the original document.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Certificate verification portal
          {valid && cert ? ` · ${cert.organization}` : ''}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={`text-right ${strong ? 'font-semibold text-gray-900' : 'text-gray-800'} ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
