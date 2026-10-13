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
          textContent: `Your Booyah Win login code is ${otp}. It will expire in 10 minutes.`,
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
    text: `Your Booyah Win login code is ${otp}. It will expire in 10 minutes.`,
  };

  try {
    await mailer.sendMail(mailOptions);
  } catch (err) {
    logger.error({ err, email: normalizedEmail }, 'Failed to send OTP email via Gmail SMTP');
    throw err;
  }
}
