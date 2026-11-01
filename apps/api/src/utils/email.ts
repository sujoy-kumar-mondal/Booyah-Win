import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// In-memory store for test verification
export const testOtpStore = new Map<string, string>();

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (!config.GMAIL_USER || !config.GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials (GMAIL_USER, GMAIL_APP_PASSWORD) are required in production.');
    }
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.GMAIL_USER,
        pass: config.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export function resetTransporterForTests(): void {
  transporter = null;
}

export function generateOtpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Booyah Win Login Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080912; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #e2e8f0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #080912; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #121424; border: 1px solid #232742; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 30px 24px 30px; text-align: center; background: linear-gradient(180deg, #181b33 0%, #121424 100%); border-bottom: 1px solid #1f233d;">
              <div style="display: inline-block;">
                <span style="font-size: 26px; font-weight: 900; letter-spacing: 1.5px; color: #ffffff; text-transform: uppercase;">
                  BOOYAH <span style="color: #10b981;">WIN</span>
                </span>
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f59e0b; text-transform: uppercase; margin-top: 4px;">
                  ESPORTS TOURNAMENT PLATFORM
                </div>
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 30px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #f8fafc; text-align: center; letter-spacing: -0.3px;">
                Verification Code
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 22px; color: #94a3b8; text-align: center;">
                Use the one-time verification code below to securely sign in to your Booyah Win account.
              </p>

              <!-- OTP Hero Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; background-color: #0a0b14; border: 2px dashed #10b981; border-radius: 12px;">
                      <tr>
                        <td align="center" style="padding: 10px 24px;">
                          <span style="font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #10b981; display: inline-block; padding-left: 6px;">
                            ${otp}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 12px; line-height: 18px; color: #fbbf24; text-align: center;">
                    &#9201; <strong>This code will expire in 10 minutes.</strong><br/>
                    Never share this code with anyone. Booyah Win staff will never ask for your verification code.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #64748b; text-align: center;">
                If you didn't request this code, you can safely ignore this email. Someone may have mistyped their email address.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px 28px 30px; background-color: #0b0c16; border-top: 1px solid #1a1d30; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">
                &copy; ${new Date().getFullYear()} Booyah Win. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Play Free Fire Tournaments & Win Real Cash Prizes.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Print OTPs to console only when NODE_ENV is exactly "development" or "test"
  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'test') {
    if (env === 'test') {
      testOtpStore.set(normalizedEmail, otp);
    }
    console.log(`[OTP CONSOLE] To: ${normalizedEmail} | Code: ${otp} (valid for 10 minutes)`);
    return;
  }

  const htmlContent = generateOtpEmailHtml(otp);
  const textContent = `Your Booyah Win login code is ${otp}. It will expire in 10 minutes.`;

  // 2. If BREVO_API_KEY is set, send via Brevo HTTPS REST API (bypasses Render SMTP port blocking)
  const brevoKey = (config.BREVO_API_KEY || process.env.BREVO_API_KEY || '').trim();
  if (brevoKey) {
    const senderEmail = config.GMAIL_USER || 'noreply@booyah.win';
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'Booyah Win',
            email: senderEmail,
          },
          to: [
            {
              email: normalizedEmail,
            },
          ],
          subject: 'Your Booyah Win login code',
          textContent,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error({ status: response.status, err: errText, email: normalizedEmail }, 'Failed to send OTP email via Brevo API');
        throw new Error(`Failed to send email via Brevo API (HTTP ${response.status}): ${errText}`);
      }

      logger.info({ email: normalizedEmail }, 'Successfully sent OTP email via Brevo API');
      return;
    } catch (err: any) {
      logger.error({ err: err.message, email: normalizedEmail }, 'Failed to send OTP email via Brevo HTTPS API');
      throw err;
    }
  }

  // 3. Otherwise fall back to Gmail SMTP
  const mailer = getTransporter();
  const mailOptions = {
    from: `"Booyah Win" <${config.GMAIL_USER}>`,
    to: normalizedEmail,
    subject: 'Your Booyah Win login code',
    text: textContent,
    html: htmlContent,
  };

  try {
    await mailer.sendMail(mailOptions);
  } catch (err) {
    logger.error({ err, email: normalizedEmail }, 'Failed to send OTP email via Gmail SMTP');
    throw err;
  }
}
