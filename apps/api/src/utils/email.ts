import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// In-memory store for test verification
export const testOtpStore = new Map<string, string>();

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
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

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Print OTPs to console only when NODE_ENV is exactly "development" or "test"
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    if (config.NODE_ENV === 'test') {
      testOtpStore.set(normalizedEmail, otp);
    }
    console.log(`[OTP CONSOLE] To: ${normalizedEmail} | Code: ${otp} (valid for 10 minutes)`);
    return;
  }

  // In every other case send real email via Gmail SMTP
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
