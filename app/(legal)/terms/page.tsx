import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The agreement between Broker365 and subscribers using the platform — what you may do, what we guarantee, and how disputes are resolved.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

/**
 * Placeholder terms of service for Broker365. BEFORE GOING LIVE:
 *   - Confirm the governing-law clause matches where the business is
 *     registered (currently assumed Rajasthan).
 *   - Align the refund window with what the landing page advertises
 *     (currently 14 days, mirrored here).
 *   - Have a lawyer verify the liability cap, indemnity, and SLA sections
 *     against the Indian Contract Act 1872 and Consumer Protection Act 2019.
 */
export default function TermsPage() {
  return (
    <article className="legal-article">
      <p className="legal-kicker">Last updated: 22 April 2026</p>
      <h1>Terms of Service</h1>
      <p className="legal-lede">
        These terms govern your use of Broker365. By signing in or submitting an
        onboarding enquiry you agree to them. If you do not, please do not use the
        service.
      </p>

      <section>
        <h2>1. Who can use Broker365</h2>
        <p>
          Broker365 is invite-only and intended for registered real-estate
          brokerages in India. You must be at least 18, authorised to act on
          behalf of your brokerage, and able to form a binding contract.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          You are responsible for everything that happens under your account.
          Keep your password and OTP codes private, enable device-trust only on
          devices you control, and tell us immediately at{' '}
          <a href="mailto:hello@broker365.in">hello@broker365.in</a> if you
          suspect unauthorised access.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <ul>
          <li>Don&apos;t attempt to break, overload, or reverse-engineer the service.</li>
          <li>Don&apos;t use Broker365 to send unsolicited bulk messages or scrape third-party sites.</li>
          <li>Don&apos;t upload content you don&apos;t own or have permission to store.</li>
          <li>Don&apos;t impersonate another brokerage or agent.</li>
        </ul>
      </section>

      <section>
        <h2>4. Subscription, pricing, and refunds</h2>
        <p>
          Plans renew monthly unless cancelled. Published prices are in INR,
          exclusive of GST. New brokerages are eligible for a{' '}
          <strong>14-day money-back guarantee</strong> from the first paid
          invoice — email us and we&apos;ll refund in full, no questions asked.
          After that window, partial-month refunds are discretionary.
        </p>
      </section>

      <section>
        <h2>5. Your data</h2>
        <p>
          You own everything your team uploads. We process it on your
          instructions as described in our{' '}
          <a href="/privacy">Privacy Policy</a>. On cancellation you may
          request a full Excel / JSON export within 30 days; after that we
          delete the backups.
        </p>
      </section>

      <section>
        <h2>6. Service availability</h2>
        <p>
          We target 99.5% monthly uptime, measured from Vercel&apos;s and
          MongoDB Atlas&apos; status pages. Planned maintenance is announced at
          least 24 hours ahead. We aren&apos;t liable for downtime caused by
          third-party infrastructure outside our reasonable control.
        </p>
      </section>

      <section>
        <h2>7. Termination</h2>
        <p>
          Either party may terminate with 30 days&apos; notice. We may suspend
          an account immediately for non-payment, breach of these terms, or
          activity that threatens other customers&apos; data.
        </p>
      </section>

      <section>
        <h2>8. Liability</h2>
        <p>
          To the extent permitted by law, our total liability in any rolling
          12-month period is capped at the fees paid by you during that
          period. We are not liable for indirect, incidental, or
          consequential losses (including lost deals or commissions).
        </p>
      </section>

      <section>
        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will
          be emailed to the registered admin at least 14 days in advance.
          Continued use after the effective date constitutes acceptance.
        </p>
      </section>

      <section>
        <h2>10. Governing law</h2>
        <p>
          These terms are governed by the laws of India. Disputes fall under
          the exclusive jurisdiction of the courts of Jaipur, Rajasthan.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Email <a href="mailto:hello@broker365.in">hello@broker365.in</a> for
          anything — billing, legal, bugs, or a human to talk to.
        </p>
        <p className="legal-note">
          This is an early draft. Please review with a lawyer before
          publication.
        </p>
      </section>
    </article>
  );
}
