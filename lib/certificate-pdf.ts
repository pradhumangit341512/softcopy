/**
 * Client-side certificate rendering: QR generation + a vector PDF built with
 * jsPDF drawing primitives (crisp text, no html2canvas snapshotting — which
 * chokes on Tailwind v4 oklch colors). Bright, premium landscape A4 matching
 * the on-screen Broker365 certificate, with logo + round seal embedded as
 * rasterized images.
 *
 * Browser-only (uses Image/canvas/jsPDF). Import from client components.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { PublicCertificate } from './certificates';
import {
  buildCertificateBody,
  studentDetailRows,
  segmentsToText,
  formatCertDate,
  CERTIFICATE_TITLE,
  INTRO_LINE,
  BRAND_LOGO_URL,
  BRAND_TAGLINE,
  BRAND_NAME,
  SEAL_TOP_TEXT,
  SEAL_CENTER_TEXT,
} from './certificate-options';
import { buildSealSvg, sealToDataUrl } from './certificate-seal';

// RGB tuples of the shared brand palette.
const BLUE: [number, number, number] = [45, 92, 255];
const DARK: [number, number, number] = [26, 59, 209];
const GOLD: [number, number, number] = [176, 141, 62];
const INK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];

/** Encode a verification URL as a PNG data URL for on-screen + PDF QR display. */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/**
 * Rasterize an image URL (incl. SVG data URLs) to a PNG data URL so jsPDF can
 * embed it. Returns null on load/CORS failure so the PDF degrades gracefully.
 */
async function rasterizeImage(
  url: string,
  pxW = 0,
  pxH = 0
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = 3;
        const w = (pxW || img.naturalWidth || 240) * scale;
        const h = (pxH || img.naturalHeight || 240) * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: w, height: h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Build the certificate as a bright, premium landscape A4 jsPDF document. */
async function buildDoc(cert: PublicCertificate, verifyUrl: string): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 297
  const H = doc.internal.pageSize.getHeight(); // 210
  const cx = W / 2;

  // Rasterize logo + seal up front (parallel).
  const [logo, seal] = await Promise.all([
    rasterizeImage(BRAND_LOGO_URL),
    rasterizeImage(sealToDataUrl(buildSealSvg(SEAL_TOP_TEXT, SEAL_CENTER_TEXT)), 240, 240),
  ]);

  // ── Background + ornate frame ──
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(1.6);
  doc.rect(6, 6, W - 12, H - 12);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.rect(9, 9, W - 18, H - 18);
  // Corner diamonds
  doc.setFillColor(...GOLD);
  for (const [x, y] of [[10.5, 10.5], [W - 10.5, 10.5], [10.5, H - 10.5], [W - 10.5, H - 10.5]] as const) {
    doc.rect(x - 1.4, y - 1.4, 2.8, 2.8, 'F');
  }

  let y = 20;

  // ── Logo + tagline ──
  if (logo) {
    const maxW = 55;
    const maxH = 16;
    const ratio = logo.width / logo.height;
    let dw = maxW;
    let dh = dw / ratio;
    if (dh > maxH) {
      dh = maxH;
      dw = dh * ratio;
    }
    doc.addImage(logo.dataUrl, 'PNG', cx - dw / 2, y, dw, dh);
    y += dh + 3;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...DARK);
    doc.text(BRAND_NAME, cx, y + 8, { align: 'center' });
    y += 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(BRAND_TAGLINE.toUpperCase(), cx, y, { align: 'center', charSpace: 1.5 });
  y += 9;

  // ── Title ──
  doc.setFont('times', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...DARK);
  doc.text(CERTIFICATE_TITLE, cx, y + 4, { align: 'center', charSpace: 0.4 });
  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.7);
  doc.line(cx - 26, y, cx + 26, y);
  y += 9;

  // ── Recipient ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(INTRO_LINE, cx, y, { align: 'center' });
  y += 13;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(32);
  doc.setTextColor(...BLUE);
  doc.text(cert.internName, cx, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(cx - 65, y, cx + 65, y);
  y += 9;

  // ── Body ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  const bodyText = segmentsToText(buildCertificateBody(cert));
  const lines = doc.splitTextToSize(bodyText, 210);
  doc.text(lines, cx, y, { align: 'center', lineHeightFactor: 1.55 });
  y += lines.length * 6.2;

  if (cert.performance) {
    doc.setFont('times', 'italic');
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    const perf = doc.splitTextToSize(`“${cert.performance}”`, 200);
    doc.text(perf, cx, y + 2, { align: 'center', lineHeightFactor: 1.5 });
    y += 2 + perf.length * 5;
  }

  // Student details — left-aligned "Label: value" rows.
  const detailRows = studentDetailRows(cert);
  if (detailRows.length) {
    let dy = y + 5;
    doc.setFontSize(9.5);
    for (const r of detailRows) {
      const label = `${r.label}:  `;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text(label, 26, dy);
      const lw = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(r.value, 26 + lw, dy);
      dy += 5;
    }
  }

  // ── Footer: signature (left) · QR (center) · seal (right) ──
  const footBaseY = H - 34;

  // Signature
  const sigX1 = 26;
  const sigX2 = 88;
  const sigCx = (sigX1 + sigX2) / 2;
  if (cert.signatoryName) {
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(cert.signatoryName, sigCx, footBaseY - 2, { align: 'center' });
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(sigX1, footBaseY, sigX2, footBaseY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(cert.signatoryTitle || 'Authorized Signatory', sigCx, footBaseY + 5, { align: 'center' });

  // QR (center)
  try {
    const qr = await generateQrDataUrl(verifyUrl);
    const qrSize = 26;
    const qrX = cx - qrSize / 2;
    const qrY = footBaseY - qrSize + 2;
    doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text('Scan to verify', cx, qrY + qrSize + 3.5, { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text(cert.certificateId, cx, qrY + qrSize + 7, { align: 'center' });
  } catch {
    /* QR is best-effort */
  }

  // Seal (right)
  if (seal) {
    const s = 30;
    doc.addImage(seal.dataUrl, 'PNG', W - 26 - s, footBaseY - s + 4, s, s);
  }

  // ── Bottom caption ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Issued on ${formatCertDate(cert.issueDate)}  ·  Verify anytime by scanning the QR code`,
    cx,
    H - 13,
    { align: 'center' }
  );

  // ── Revoked watermark ──
  if (cert.status === 'revoked') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(90);
    doc.setTextColor(220, 38, 38);
    doc.saveGraphicsState();
    doc.setGState(
      new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.16 })
    );
    doc.text('REVOKED', cx, H / 2 + 18, { align: 'center', angle: 20 });
    doc.restoreGraphicsState();
  }

  return doc;
}

/** File-safe name like "Certificate-INTERN-2026-K7P2QX.pdf". */
function pdfFilename(cert: PublicCertificate): string {
  const safe = cert.certificateId.replace(/[^a-z0-9-]/gi, '');
  return `Certificate-${safe}.pdf`;
}

/** Build + trigger a browser download of the certificate PDF. */
export async function downloadCertificatePdf(
  cert: PublicCertificate,
  verifyUrl: string
): Promise<void> {
  const doc = await buildDoc(cert, verifyUrl);
  doc.save(pdfFilename(cert));
}

/** Build the certificate PDF as a File for the Web Share API. */
export async function getCertificatePdfFile(
  cert: PublicCertificate,
  verifyUrl: string
): Promise<File> {
  const doc = await buildDoc(cert, verifyUrl);
  const blob = doc.output('blob');
  return new File([blob], pdfFilename(cert), { type: 'application/pdf' });
}
