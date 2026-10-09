import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { sendOtpEmail, testOtpStore } from '../src/utils/email.js';
import { config } from '../src/config/index.js';

describe('OTP Email Delivery Rules', () => {
  beforeEach(() => {
    testOtpStore.clear();
    vi.restoreAllMocks();
  });

  it('prints OTP to console in development and test mode, without calling nodemailer', async () => {
    const sendMailMock = vi.fn();
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock,
    } as any);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // In test environment
    process.env.NODE_ENV = 'test';
    await sendOtpEmail('test_console@booyah.win', '123456');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OTP CONSOLE] To: test_console@booyah.win | Code: 123456')
    );
    expect(testOtpStore.get('test_console@booyah.win')).toBe('123456');
    expect(sendMailMock).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('attempts real email send via Gmail SMTP when NODE_ENV is production', async () => {
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test-id' });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock,
    } as any);

    process.env.NODE_ENV = 'production';
    process.env.GMAIL_USER = 'service@booyah.win';
    process.env.GMAIL_APP_PASSWORD = 'secret-app-password';

    await sendOtpEmail('player@example.com', '654321');

    expect(sendMailMock).toHaveBeenCalledWith({
      from: '"Booyah Win" <service@booyah.win>',
      to: 'player@example.com',
      subject: 'Your Booyah Win login code',
      text: 'Your Booyah Win login code is 654321. It will expire in 10 minutes.',
    });

    // Reset back to test
    process.env.NODE_ENV = 'test';
  });
});
