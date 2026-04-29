import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Broker365 collects, stores, and uses data from subscribers and visitors. Summary of your rights under Indian data-protection law.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

/**
 * Placeholder privacy policy. Written as a starting point for an Indian
 * brokerage SaaS — reflects what the product actually does today (JWT
 * auth, OTP sign-in, server-side logs, Sentry error tracking, Razorpay
 * payments, optional WhatsApp automation). BEFORE GOING LIVE:
 *
 *   1. Review with a lawyer familiar with the Digital Personal Data
 *      Protection Act, 2023 (DPDPA) and the IT Rules, 2011.
 *   2. Add the registered business address, the name + email of the
 *      Data Protection Officer, and the grievance-redressal contact.
 *   3. If you run targeted ads or remarketing, list every third-party
 *      processor (Meta, Google Ads, etc.) and what they receive.
 */
export default function PrivacyPage() {
  return (
    <article className="legal-article">
      <p className="legal-kicker">Last updated: 22 April 2026</p>
      <h1>Privacy Policy</h1>
      <p className="legal-lede">
        This policy explains what personal data Broker365 collects from subscribers
        and visitors, why we collect it, how long we keep it, and how to contact us
        if you want it changed or deleted.
      </p>

      <section>
        <h2>1. Who we are</h2>
        <p>
          Broker365 (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an invite-only customer-relationship-management
          platform for Indian real-estate brokerages. Visiting{' '}
          <a href="https://broker365.in">broker365.in</a> or using the dashboard at
          /dashboard means you agree to the processing described here.
        </p>
      </section>

      <section>
        <h2>2. Data we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — name, business email, phone number, role,
            and the brokerage you belong to. Required to create and secure your
            account.
          </li>
          <li>
            <strong>Operational data</strong> — clients, Inventory, pipeline stages,
            commissions, and any notes you enter into the CRM. Stored on your
            behalf; never sold or shared.
          </li>
          <li>
            <strong>Authentication data</strong> — password hashes (bcrypt, 12 rounds),
            OTP codes (hashed, 10-minute expiry), session records with IP and
            user-agent. Used only to authenticate and to alert you of suspicious
            sign-ins.
          </li>
          <li>
            <strong>Logs and telemetry</strong> — request IP, user-agent, timestamp,
            and an anonymised request ID. Error traces flow into Sentry with
            personal-data scrubbing enabled.
          </li>
          <li>
            <strong>Payment records</strong> — Razorpay handles card/UPI details
            directly; we only ever see the transaction reference and status.
          </li>
          <li>
            <strong>Onboarding enquiries</strong> — if you submit the landing-page
            form, we store the name, company, email, phone, city, team size, and
            message you provided so a human can reply.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Why we process it</h2>
        <ul>
          <li>To run and secure your account (contractual necessity).</li>
          <li>To send you sign-in codes, security alerts, and weekly performance emails you&apos;ve opted into.</li>
          <li>To investigate abuse, prevent fraud, and respect lawful requests (legitimate interest).</li>
          <li>To improve the product via aggregated, de-identified usage analytics.</li>
        </ul>
      </section>

      <section>
        <h2>4. How long we keep it</h2>
        <p>
          Operational data stays in your workspace until your brokerage deletes it
          or ends their subscription. After cancellation we retain backups for 30
          days and then delete them. Audit logs are retained for 12 months for
          compliance. OTP codes are wiped once consumed or after 10 minutes.
        </p>
      </section>

      <section>
        <h2>5. Who we share it with</h2>
        <ul>
          <li><strong>MongoDB Atlas</strong> — primary datastore (region: Mumbai).</li>
          <li><strong>Resend / Gmail SMTP</strong> — outbound email delivery.</li>
          <li><strong>Razorpay</strong> — payment processing.</li>
          <li><strong>WhatsApp Business API</strong> — only when you enable WhatsApp automation.</li>
          <li><strong>Sentry</strong> — error reporting with personal data scrubbed.</li>
          <li><strong>Vercel</strong> — hosting and CDN.</li>
        </ul>
        <p>We never sell personal data, ever.</p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          Under the Digital Personal Data Protection Act 2023 you can ask us to
          access, correct, or delete your personal data, and to nominate a person
          to act on your behalf in the event of incapacity. Email{' '}
          <a href="mailto:hello@broker365.in">hello@broker365.in</a> and we&apos;ll
          respond within 30 days.
        </p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>
          We set one strictly-necessary cookie (<code>auth_token</code>) to keep
          you signed in. It is <em>httpOnly</em> and <em>SameSite=Lax</em>. No
          third-party advertising cookies are set from our domain.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          Privacy questions:{' '}
          <a href="mailto:hello@broker365.in">hello@broker365.in</a>.
        </p>
        <p className="legal-note">
          This is an early draft. Please review with a lawyer before publication
          — especially the Data Protection Officer, registered address, and
          grievance contact sections required by DPDPA and the IT Rules 2011.
        </p>
      </section>
    </article>
  );
}
