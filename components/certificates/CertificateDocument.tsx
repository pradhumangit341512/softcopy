'use client';

/**
 * Presentational Broker365 internship certificate — a bright, premium landscape
 * document with ornate borders, the brand logo, a round official seal/stamp,
 * student details, and the verification QR. Visually mirrors the downloadable
 * PDF (lib/certificate-pdf.ts).
 *
 * RESPONSIVE STRATEGY: the certificate is laid out once at a fixed design size
 * (1000×707, the A4-landscape ratio) using real px spacing, then scaled to fit
 * its container via a ResizeObserver. This keeps every gap, margin, and font
 * proportion pixel-identical on phones, tablets, and desktop — the whole
 * document simply shrinks to fit.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PublicCertificate } from '@/lib/certificates';
import {
  buildCertificateBody,
  studentDetailRows,
  formatCertDate,
  CERTIFICATE_TITLE,
  INTRO_LINE,
  BRAND_LOGO_URL,
  BRAND_TAGLINE,
  BRAND_NAME,
  SEAL_TOP_TEXT,
  SEAL_CENTER_TEXT,
  type CertSegment,
} from '@/lib/certificate-options';
import { buildSealSvg, sealToDataUrl } from '@/lib/certificate-seal';

const DESIGN_W = 1000;
const DESIGN_H = 707; // 1000 × (210/297)

const sealDataUrl = sealToDataUrl(buildSealSvg(SEAL_TOP_TEXT, SEAL_CENTER_TEXT));

// useLayoutEffect on the client, useEffect on the server (avoids SSR warning).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface CertificateDocumentProps {
  cert: PublicCertificate;
  /** PNG data URL of the verification QR code. */
  qrDataUrl?: string | null;
}

export function CertificateDocument({ cert, qrDataUrl }: CertificateDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useIsoLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DESIGN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isRevoked = cert.status === 'revoked';
  const body: CertSegment[] = buildCertificateBody(cert);
  const detailRows = studentDetailRows(cert);

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full max-w-[1000px] overflow-hidden"
      // Reserve the scaled height so surrounding layout doesn't jump.
      style={{ height: scale ? DESIGN_H * scale : undefined, aspectRatio: scale ? undefined : `${DESIGN_W}/${DESIGN_H}` }}
    >
      <div
        style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale || 0.001})`, transformOrigin: 'top left' }}
        className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50/50 to-amber-50/50 shadow-2xl ring-1 ring-black/10"
      >
        {/* Ornate double frame */}
        <div className="pointer-events-none absolute inset-[16px] rounded-[3px] border-[3px] border-[#2d5cff]" />
        <div className="pointer-events-none absolute inset-[24px] rounded-[2px] border border-[#b08d3e]" />
        {/* Corner diamonds */}
        {[
          'left-[20px] top-[20px]',
          'right-[20px] top-[20px]',
          'left-[20px] bottom-[20px]',
          'right-[20px] bottom-[20px]',
        ].map((pos) => (
          <span key={pos} className={`absolute ${pos} h-[12px] w-[12px] rotate-45 bg-[#b08d3e]`} />
        ))}

        {isRevoked && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="rotate-[-20deg] select-none text-[150px] font-black uppercase tracking-[0.1em] text-red-600/15">
              Revoked
            </span>
          </div>
        )}

        {/* Content */}
        <div className="relative flex h-full flex-col items-center px-[78px] pb-[36px] pt-[42px] text-center">
          {/* Logo + tagline */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-[54px] w-auto object-contain" />
          <p className="mt-[6px] text-[11px] font-semibold uppercase tracking-[0.4em] text-[#b08d3e]">
            {BRAND_TAGLINE}
          </p>

          {/* Title */}
          <h1 className="mt-[14px] font-serif text-[46px] font-bold leading-none tracking-wide text-[#1a3bd1]">
            {CERTIFICATE_TITLE}
          </h1>
          <span className="mt-[12px] flex items-center gap-[10px]">
            <span className="h-px w-[52px] bg-[#b08d3e]" />
            <span className="h-[7px] w-[7px] rotate-45 bg-[#b08d3e]" />
            <span className="h-px w-[52px] bg-[#b08d3e]" />
          </span>

          {/* Recipient */}
          <p className="mt-[18px] text-[15px] text-gray-500">{INTRO_LINE}</p>
          <p className="mt-[8px] font-serif text-[50px] font-bold italic leading-none text-[#2d5cff]">
            {cert.internName}
          </p>
          <span className="mt-[8px] block h-px w-[440px] max-w-[80%] bg-[#2d5cff]/50" />

          {/* Body */}
          <p className="mt-[18px] max-w-[780px] text-[17px] leading-[1.7] text-gray-700">
            {body.map((s, i) =>
              s.bold ? (
                <span key={i} className="font-semibold text-gray-900">
                  {s.text}
                </span>
              ) : (
                <span key={i}>{s.text}</span>
              )
            )}
          </p>
          {cert.performance && (
            <p className="mt-[10px] max-w-[720px] text-[13px] italic leading-[1.6] text-gray-500">
              “{cert.performance}”
            </p>
          )}

          {/* Student details (left-aligned) */}
          {detailRows.length > 0 && (
            <div className="mt-[16px] w-full max-w-[560px] self-start rounded-[6px] border border-[#b08d3e]/40 bg-white/70 px-[18px] py-[10px] text-left">
              <dl className="grid grid-cols-2 gap-x-[28px] gap-y-[4px]">
                {detailRows.map((r) => (
                  <div key={r.label} className="flex gap-[6px] text-[13px] leading-tight">
                    <dt className="shrink-0 font-semibold text-gray-700">{r.label}:</dt>
                    <dd className="text-gray-900">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Footer: signature · QR · seal */}
          <div className="mt-auto flex w-full items-end justify-between gap-[28px] pt-[24px]">
            {/* Signature */}
            <div className="flex-1 text-center">
              {cert.signatoryName && (
                <p className="mb-[4px] font-serif text-[16px] italic text-gray-800">{cert.signatoryName}</p>
              )}
              <div className="mx-auto w-[180px] border-t border-gray-700" />
              <p className="mt-[5px] text-[12px] text-gray-500">
                {cert.signatoryTitle || 'Authorized Signatory'}
              </p>
            </div>

            {/* QR */}
            <div className="flex flex-1 flex-col items-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Verification QR code"
                  className="h-[92px] w-[92px] rounded-[4px] bg-white p-[3px] ring-1 ring-gray-200"
                />
              ) : (
                <div className="h-[92px] w-[92px] animate-pulse rounded-[4px] bg-gray-100" />
              )}
              <p className="mt-[6px] text-[11px] font-medium text-gray-500">Scan to verify</p>
              <p className="font-mono text-[10px] text-gray-400">{cert.certificateId}</p>
            </div>

            {/* Seal */}
            <div className="flex flex-1 justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sealDataUrl} alt="Official seal" className="h-[118px] w-[118px]" />
            </div>
          </div>

          <p className="mt-[14px] text-[11px] text-gray-400">
            Issued on {formatCertDate(cert.issueDate)} · Verify anytime by scanning the QR code above
          </p>
        </div>
      </div>
    </div>
  );
}
