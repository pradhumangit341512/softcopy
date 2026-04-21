// lib/email.ts
// Tries Resend first → if it fails (free tier restriction), falls back to Gmail SMTP
// This way OTP reaches ANY email address

import { Resend } from 'resend';
import nodemailer from 'nodemailer';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
const FROM_RESEND = 'onboarding@resend.dev';
const FROM_GMAIL  = process.env.GMAIL_USER ?? '';

// ── Gmail transporter ──
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 5000,
  greetingTimeout:   5000,
  socketTimeout:     10000,
});

// ── Build HTML ──
function buildHTML(otp: string, heading: string, description: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#fff;border-radius:12px;
              box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
              <tr>
                <td style="background:#2563eb;padding:28px 32px;">
                  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">BrokerCRM</p>
                  <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">${heading}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 8px;color:#374151;font-size:15px;">${description}</p>
                  <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">
                    This code expires in <strong>10 minutes</strong>.
                    Do not share it with anyone.
                  </p>
                  <div style="text-align:center;margin:24px 0;">
                    <div style="display:inline-block;background:#eff6ff;
                      border:2px dashed #2563eb;border-radius:12px;padding:20px 48px;">
                      <p style="margin:0;font-size:40px;font-weight:800;
                        letter-spacing:12px;color:#1d4ed8;">
                        ${otp}
                      </p>
                    </div>
                  </div>
                  <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                    If you didn't request this, please ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
                    © ${new Date().getFullYear()} BrokerCRM. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendOTPEmail(
  toEmail: string,
  otp: string,
  purpose: 'login' | 'signup' | 'reset'
): Promise<void> {
  const subject =
    purpose === 'login'  ? 'Your Login OTP — BrokerCRM'        :
    purpose === 'signup' ? 'Verify Your Email — BrokerCRM'      :
                           'Reset Your Password — BrokerCRM';

  const heading =
    purpose === 'login'  ? 'Login Verification Code'  :
    purpose === 'signup' ? 'Email Verification Code'  :
                           'Password Reset Code';

  const description =
    purpose === 'login'  ? 'Use the code below to complete your login.'                          :
    purpose === 'signup' ? 'Use the code below to verify your email and complete registration.'  :
                           'Use the code below to reset your password.';

  const html = buildHTML(otp, heading, description);

  // ── Step 1: Try Resend (with 5s timeout) ──
  const resend = getResend();
  let resendError: Error | null = null;
  if (!resend) {
    resendError = new Error('RESEND_API_KEY not configured');
  } else try {
    const resendPromise = resend.emails.send({
      from:    FROM_RESEND,
      to:      toEmail,
      subject,
      html,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Resend timeout')), 5000)
    );
    const result = await Promise.race([resendPromise, timeoutPromise]) as { error?: Error };
    resendError = result?.error || null;
  } catch (err: unknown) {
    resendError = err instanceof Error ? err : new Error(String(err));
  }

  if (!resendError) {
    console.log(`✅ OTP sent via Resend to ${toEmail}`);
    return; // success — done
  }

  // ── Step 2: Resend failed → fallback to Gmail ──
  console.warn(`⚠️  Resend failed (${resendError?.message || resendError}) — falling back to Gmail for ${toEmail}`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    // No Gmail configured — log to terminal only in development
    if (process.env.NODE_ENV === 'development') {
      console.log('\n========================================');
      console.log(`DEV FALLBACK — OTP for ${toEmail} (purpose: ${purpose})`);
      console.log('========================================\n');
      return;
    }
    throw new Error('Email delivery failed — configure GMAIL_USER and GMAIL_APP_PASSWORD');
  }

  await gmailTransporter.sendMail({
    from:    `"BrokerCRM" <${FROM_GMAIL}>`,
    to:      toEmail,
    subject,
    html,
  });

  console.log(`✅ OTP sent via Gmail to ${toEmail}`);
}

// ==================== NEW LOGIN ALERT ====================

function buildLoginAlertHTML(name: string, device: string, ip: string, time: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#fff;border-radius:12px;
              box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
              <tr>
                <td style="background:#dc2626;padding:28px 32px;">
                  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">BrokerCRM</p>
                  <p style="margin:4px 0 0;color:#fecaca;font-size:13px;">Security Alert</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hi ${escapeHtml(name)},</p>
                  <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">
                    We detected a new login to your account. If this was you, no action is needed.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="margin:0 0 10px;color:#991b1b;font-size:13px;font-weight:600;">Login Details</p>
                        <p style="margin:0 0 6px;color:#374151;font-size:13px;">
                          <strong>Device:</strong> ${escapeHtml(device)}
                        </p>
                        <p style="margin:0 0 6px;color:#374151;font-size:13px;">
                          <strong>IP Address:</strong> ${escapeHtml(ip)}
                        </p>
                        <p style="margin:0;color:#374151;font-size:13px;">
                          <strong>Time:</strong> ${escapeHtml(time)}
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:20px 0 0;color:#dc2626;font-size:13px;font-weight:600;">
                    If this wasn't you, change your password immediately and use "Log out other sessions" in Settings &gt; Security.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
                    &copy; ${new Date().getFullYear()} BrokerCRM. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendLoginAlertEmail(
  toEmail: string,
  name: string,
  device: string,
  ip: string
): Promise<void> {
  const subject = 'New login to your account — BrokerCRM';
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const html = buildLoginAlertHTML(name, device, ip, time);

  const resend = getResend();
  let resendError: Error | null = null;
  if (!resend) {
    resendError = new Error('RESEND_API_KEY not configured');
  } else try {
    const resendPromise = resend.emails.send({
      from: FROM_RESEND,
      to: toEmail,
      subject,
      html,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Resend timeout')), 5000)
    );
    const result = await Promise.race([resendPromise, timeoutPromise]) as { error?: Error };
    resendError = result?.error || null;
  } catch (err: unknown) {
    resendError = err instanceof Error ? err : new Error(String(err));
  }

  if (!resendError) {
    console.log(`✅ Login alert sent via Resend to ${toEmail}`);
    return;
  }

  console.warn(`⚠️  Resend failed (${resendError.message}) — falling back to Gmail for login alert to ${toEmail}`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n========================================');
      console.log(`DEV FALLBACK — Login alert for ${toEmail}: ${device} from ${ip}`);
      console.log('========================================\n');
      return;
    }
    throw new Error('Email delivery failed — configure GMAIL_USER and GMAIL_APP_PASSWORD');
  }

  await gmailTransporter.sendMail({
    from: `"BrokerCRM" <${FROM_GMAIL}>`,
    to: toEmail,
    subject,
    html,
  });
  console.log(`✅ Login alert sent via Gmail to ${toEmail}`);
}

// ==================== EMAIL VERIFICATION LINK ====================

/**
 * Builds the "verify your email" HTML body. Kept separate from the OTP body
 * so we can iterate on either one without touching the other.
 */
function buildVerificationHTML(link: string, name: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#fff;border-radius:12px;
              box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
              <tr>
                <td style="background:#2563eb;padding:28px 32px;">
                  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">BrokerCRM</p>
                  <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Confirm your email</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hi ${escapeHtml(name)},</p>
                  <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
                    Click the button below to confirm this email address and activate your account.
                    The link expires in <strong>24 hours</strong>.
                  </p>
                  <div style="text-align:center;margin:24px 0;">
                    <a href="${link}"
                      style="display:inline-block;background:#2563eb;color:#fff;
                      text-decoration:none;padding:14px 28px;border-radius:10px;
                      font-weight:600;font-size:15px;">
                      Verify email
                    </a>
                  </div>
                  <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
                    Or paste this link into your browser:<br>
                    <span style="color:#2563eb;word-break:break-all;">${link}</span>
                  </p>
                  <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
                    If you didn't create an account, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
                    © ${new Date().getFullYear()} BrokerCRM. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send a "verify your email" link. Same Resend → Gmail fallback as OTP mail.
 * Throws if both providers fail in production; logs to terminal in dev.
 */
export async function sendVerificationEmail(
  toEmail: string,
  verifyLink: string,
  name: string
): Promise<void> {
  const subject = 'Verify your email — BrokerCRM';
  const html = buildVerificationHTML(verifyLink, name);

  // ── Resend first ──
  const resend = getResend();
  let resendError: Error | null = null;
  if (!resend) {
    resendError = new Error('RESEND_API_KEY not configured');
  } else try {
    const resendPromise = resend.emails.send({
      from: FROM_RESEND,
      to: toEmail,
      subject,
      html,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Resend timeout')), 5000)
    );
    const result = await Promise.race([resendPromise, timeoutPromise]) as { error?: Error };
    resendError = result?.error || null;
  } catch (err: unknown) {
    resendError = err instanceof Error ? err : new Error(String(err));
  }

  if (!resendError) {
    console.log(`✅ Verification email sent via Resend to ${toEmail}`);
    return;
  }

  // ── Gmail fallback ──
  console.warn(`⚠️  Resend failed (${resendError.message}) — falling back to Gmail for ${toEmail}`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n========================================');
      console.log(`DEV FALLBACK — verify link for ${toEmail}:`);
      console.log(verifyLink);
      console.log('========================================\n');
      return;
    }
    throw new Error('Email delivery failed — configure GMAIL_USER and GMAIL_APP_PASSWORD');
  }

  await gmailTransporter.sendMail({
    from: `"BrokerCRM" <${FROM_GMAIL}>`,
    to: toEmail,
    subject,
    html,
  });
  console.log(`✅ Verification email sent via Gmail to ${toEmail}`);
}