import { ImageResponse } from 'next/og';

/**
 * Open Graph image — Next.js serves this at /opengraph-image and auto-
 * wires it into the landing page's metadata. Replaces the broken URL
 * (realestate-crm.com/og-image.png) that shipped with the old layout.
 *
 * Rendered JSX is converted to a 1200×630 PNG at edge-runtime time, so
 * there's no static asset to create or update. Plain CSS-in-JS, no
 * images/fonts fetched during render.
 */

export const alt = 'Broker365 — Invite-only CRM for Indian real estate brokers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 55%, #fff1ec 100%)',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          color: '#0b1020',
        }}
      >
        {/* Top: logo + pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #1a3bd1, #2d5cff)',
              color: '#ffffff',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            B365
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'ui-serif, Georgia, serif',
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Broker365
          </div>
        </div>

        {/* Middle: headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              alignSelf: 'flex-start',
              background: '#eef2ff',
              border: '1px solid rgba(45,92,255,0.22)',
              borderRadius: 999,
              color: '#1a3bd1',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#2d5cff',
                display: 'flex',
              }}
            />
            Invite-only · Subscribers
          </div>
          <div
            style={{
              fontFamily: 'ui-serif, Georgia, serif',
              fontSize: 78,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.035em',
              display: 'flex',
            }}
          >
            The broker CRM that helps you actually close.
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#3a4155',
              maxWidth: 820,
              lineHeight: 1.35,
              display: 'flex',
            }}
          >
            Leads, inventory, commissions, and your team — on one private dashboard for Indian brokerages.
          </div>
        </div>

        {/* Bottom: url + meta */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#6b7085',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ display: 'flex' }}>broker365.in</span>
          <span style={{ display: 'flex' }}>Jaipur · Bengaluru</span>
        </div>
      </div>
    ),
    size
  );
}
