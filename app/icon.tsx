import { ImageResponse } from 'next/og';

/**
 * Dynamic favicon — Next.js picks this up at build time and serves it at
 * /icon. No static asset to maintain; the SVG-ish JSX below renders to a
 * 32×32 PNG at build.
 *
 * Replaces the old static /favicon.ico which never got updated after the
 * rename from "Real Estate CRM" to Broker365.
 */

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #1a3bd1, #2d5cff)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          letterSpacing: '-0.04em',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, monospace',
          borderRadius: 7,
        }}
      >
        B
      </div>
    ),
    size
  );
}
