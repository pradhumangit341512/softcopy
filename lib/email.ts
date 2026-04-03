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

  // ── Step 1: Try Gmail FIRST (more reliable delivery) ──
  let gmailError: any = null;

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      await gmailTransporter.sendMail({
        from:    `"BrokerCRM" <${FROM_GMAIL}>`,
        to:      toEmail,
        subject,
        html,
      });
      console.log(`✅ OTP sent via Gmail to ${toEmail}`);
      return; // success — done
    } catch (err: any) {
      gmailError = err;
      console.warn(`⚠️  Gmail failed (${err?.message}) — trying Resend for ${toEmail}`);
    }
  }

  // ── Step 2: Gmail failed or not configured → fallback to Resend ──
  const resend = getResend();
  if (resend) {
    try {
      const resendPromise = resend.emails.send({
        from:    FROM_RESEND,
        to:      toEmail,
        subject,
        html,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Resend timeout')), 5000)
      );
      const result = await Promise.race([resendPromise, timeoutPromise]) as any;
      if (result?.error) {
        throw new Error(result.error.message || 'Resend API error');
      }
      console.log(`✅ OTP sent via Resend to ${toEmail}`);
      return; // success — done
    } catch (err: any) {
      console.warn(`⚠️  Resend also failed (${err?.message}) for ${toEmail}`);
    }
  }

  // ── Both failed ──
  if (process.env.NODE_ENV === 'development') {
    console.log('\n========================================');
    console.log(`DEV FALLBACK — OTP for ${toEmail} (purpose: ${purpose})`);
    console.log('========================================\n');
    return;
  }

  throw new Error(`Email delivery failed for ${toEmail} — Gmail: ${gmailError?.message || 'not configured'}, Resend: ${resend ? 'failed' : 'not configured'}`);
}