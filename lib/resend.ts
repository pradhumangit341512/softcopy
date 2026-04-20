// lib/resend.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Your verified email from Resend dashboard ──
const VERIFIED_EMAIL = process.env.RESEND_VERIFIED_EMAIL || 'singhpradhuman077@gmail.com';
const FROM_EMAIL     = 'onboarding@resend.dev';
const IS_DEV         = process.env.NODE_ENV !== 'production';

export async function sendOTPEmail(
  toEmail: string,
  otp: string,
  purpose: 'login' | 'signup' | 'reset'
): Promise<void> {

  // ── In development: if recipient is not your verified email,
  //    just log the OTP to terminal instead of failing ──
  if (IS_DEV && toEmail !== VERIFIED_EMAIL) {
    console.log(`OTP sent to ${toEmail} (check inbox or Resend dashboard)`);
    return; // skip actual email send
  }

  const subject =
    purpose === 'login'  ? 'Your Login OTP — BrokerCRM' :
    purpose === 'signup' ? 'Verify Your Email — BrokerCRM' :
                           'Reset Your Password — BrokerCRM';

  const heading =
    purpose === 'login'  ? 'Login Verification Code'   :
    purpose === 'signup' ? 'Email Verification Code'   :
                           'Password Reset Code';

  const description =
    purpose === 'login'  ? 'Use the code below to complete your login.' :
    purpose === 'signup' ? 'Use the code below to verify your email and complete registration.' :
                           'Use the code below to reset your password.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
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
                    This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
                  </p>
                  <div style="text-align:center;margin:24px 0;">
                    <div style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;
                      border-radius:12px;padding:20px 48px;">
                      <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#1d4ed8;">
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

  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      toEmail,
    subject,
    html,
  });

  if (error) {
    console.error('Resend email error:', error);
    throw new Error('Failed to send OTP email');
  }
}