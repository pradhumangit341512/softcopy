'use client';

/**
 * Renders a finished certificate with its verification QR and the
 * download / share / copy-link actions. Shared by the create-success screen
 * (auto-show after issuing) and the certificate view page. Certificate-status
 * management (revoke/reinstate) lives in the pages, not here.
 */

import { useEffect, useState } from 'react';
import { Download, Share2, Link2, CheckCircle2, Loader2 } from 'lucide-react';
import { CertificateDocument } from '@/components/certificates/CertificateDocument';
import type { PublicCertificate } from '@/lib/certificates';
import {
  generateQrDataUrl,
  downloadCertificatePdf,
  getCertificatePdfFile,
} from '@/lib/certificate-pdf';

interface CertificatePreviewPanelProps {
  cert: PublicCertificate;
  verifyUrl: string;
}

export function CertificatePreviewPanel({ cert, verifyUrl }: CertificatePreviewPanelProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    generateQrDataUrl(verifyUrl)
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [verifyUrl]);

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadCertificatePdf(cert, verifyUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate PDF');
    } finally {
      setDownloading(false);
    }
  }

  async function onShare() {
    try {
      const file = await getCertificatePdfFile(cert, verifyUrl);
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      const shareData: ShareData = {
        title: `Internship Certificate — ${cert.internName}`,
        text: `Verify this internship certificate (${cert.certificateId}): ${verifyUrl}`,
        files: [file],
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share(shareData);
      } else if (nav.share) {
        await nav.share({ title: shareData.title, text: shareData.text, url: verifyUrl });
      } else {
        await copyLink();
      }
    } catch {
      /* user cancelled or share unsupported — no-op */
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <button
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF
        </button>
        <button
          onClick={onShare}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50 sm:w-auto"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        <button
          onClick={copyLink}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50 sm:w-auto"
        >
          {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <CertificateDocument cert={cert} qrDataUrl={qr} />

      <p className="break-all px-2 text-center text-xs text-gray-500">
        Verification link:{' '}
        <a href={verifyUrl} target="_blank" rel="noreferrer" className="font-mono text-blue-600 hover:underline">
          {verifyUrl}
        </a>
      </p>
    </div>
  );
}
