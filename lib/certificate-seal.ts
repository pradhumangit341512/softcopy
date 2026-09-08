/**
 * Round official "stamp" seal for certificates, generated as an SVG string so
 * it renders crisply on-screen (as an <img>) and rasterizes cleanly into the
 * PDF (via canvas). Pure TypeScript — safe to import anywhere.
 *
 * Layout: concentric gold/navy rings, curved brand text along the top arc, a
 * central star, and a straight center label. Only the TOP text is curved
 * (guaranteed upright across renderers); the center is horizontal.
 */

const GOLD = '#b08d3e';
const NAVY = '#1a3bd1';

/**
 * @param topText   Brand text curved along the top arc (e.g. "BROKER365 · INTERNSHIP").
 * @param centerText Straight label in the middle (e.g. "VERIFIED").
 */
export function buildSealSvg(topText: string, centerText: string): string {
  const top = topText.toUpperCase();
  const center = centerText.toUpperCase();
  // Star centered at (120,104).
  const star =
    'M120 88 l6.5 20 21 0 -17 12.5 6.5 20 -17 -12.5 -17 12.5 6.5 -20 -17 -12.5 21 0 Z';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <path id="sealTopArc" d="M 44 120 A 76 76 0 0 1 196 120" fill="none"/>
  </defs>
  <circle cx="120" cy="120" r="114" fill="#ffffff" fill-opacity="0.0"/>
  <circle cx="120" cy="120" r="112" fill="none" stroke="${GOLD}" stroke-width="4"/>
  <circle cx="120" cy="120" r="102" fill="none" stroke="${NAVY}" stroke-width="1.5"/>
  <circle cx="120" cy="120" r="74" fill="none" stroke="${GOLD}" stroke-width="1.5"/>
  <text font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="bold" fill="${NAVY}" letter-spacing="2.5">
    <textPath href="#sealTopArc" startOffset="50%" text-anchor="middle">${escapeXml(top)}</textPath>
  </text>
  <path d="${star}" fill="${GOLD}"/>
  <text x="120" y="150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" font-weight="bold" fill="${NAVY}" letter-spacing="3">${escapeXml(center)}</text>
  <text x="120" y="166" text-anchor="middle" font-family="Arial, sans-serif" font-size="8.5" fill="${GOLD}" letter-spacing="2">CERTIFICATE</text>
  <circle cx="63" cy="120" r="2.4" fill="${GOLD}"/>
  <circle cx="177" cy="120" r="2.4" fill="${GOLD}"/>
</svg>`;
}

/** Encode an SVG string as a data URL usable by <img src> and canvas rasterization. */
export function sealToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
