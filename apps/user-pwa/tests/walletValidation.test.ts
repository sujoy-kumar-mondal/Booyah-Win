import { describe, it, expect } from 'vitest';
import {
  validateDepositAmount,
  validateWithdrawAmount,
  validateUtr,
  validateScreenshot,
  parsePaiseSafe,
} from '../src/utils/validation.js';
import { formatSignedRupees, formatIndianRupees } from '../src/utils/formatters.js';

describe('Wallet Validations & Money Formatters (Requirements 6, 8, 12)', () => {
  describe('Deposit Amount Validation (Requirement 6: API Limits)', () => {
    it('rejects empty or non-numeric amounts', () => {
      expect(validateDepositAmount('')).toBe('Amount is required');
      expect(validateDepositAmount('abc')).toBe('Enter a valid amount with at most 2 decimal places');
      expect(validateDepositAmount('-10.00')).toBe('Enter a valid amount with at most 2 decimal places');
      expect(validateDepositAmount('10.999')).toBe('Enter a valid amount with at most 2 decimal places');
      expect(validateDepositAmount('0')).toBe('Amount must be greater than zero');
      expect(validateDepositAmount('0.00')).toBe('Amount must be greater than zero');
    });

    it('enforces min and max strictly from the API (Requirement 6: No hardcoded limits)', () => {
      // Dynamic API limits: e.g. min 25.00, max 2000.00
      const apiMin = '25.00';
      const apiMax = '2000.00';

      expect(validateDepositAmount('24.99', apiMin, apiMax)).toBe('Minimum deposit is Rs25.00');
      expect(validateDepositAmount('25.00', apiMin, apiMax)).toBeNull();
      expect(validateDepositAmount('1500.50', apiMin, apiMax)).toBeNull();
      expect(validateDepositAmount('2000.00', apiMin, apiMax)).toBeNull();
      expect(validateDepositAmount('2000.01', apiMin, apiMax)).toBe('Maximum deposit is Rs2000.00');
    });

    it('works safely when limits are not provided', () => {
      expect(validateDepositAmount('100.00')).toBeNull();
      expect(validateDepositAmount('1.00')).toBeNull();
    });
  });

  describe('Withdrawal Amount Validation', () => {
    it('enforces minimum 50.00 and winning balance ceiling', () => {
      const winningBalance = '120.00';

      expect(validateWithdrawAmount('')).toBe('Amount is required');
      expect(validateWithdrawAmount('49.99', winningBalance)).toBe('Minimum withdrawal is Rs50.00');
      expect(validateWithdrawAmount('50.00', winningBalance)).toBeNull();
      expect(validateWithdrawAmount('120.00', winningBalance)).toBeNull();
      expect(validateWithdrawAmount('120.01', winningBalance)).toBe(
        'Withdrawal amount cannot exceed your Winning balance'
      );
    });
  });

  describe('UTR Validation (Section 4.5)', () => {
    it('accepts 10-25 alphanumeric characters', () => {
      expect(validateUtr('1234567890')).toBeNull();
      expect(validateUtr('ABCDE1234567890')).toBeNull();
      expect(validateUtr('25CHARACTERSLONGUTR12345')).toBeNull();
    });

    it('rejects empty, short, long, or special character UTRs', () => {
      expect(validateUtr('')).toBe('UTR / transaction ID is required');
      expect(validateUtr('123456789')).toBe('UTR must be 10-25 alphanumeric characters');
      expect(validateUtr('TOOLONGUTRWITHMORETHAN26CHARACTERS')).toBe(
        'UTR must be 10-25 alphanumeric characters'
      );
      expect(validateUtr('12345-67890')).toBe('UTR must be 10-25 alphanumeric characters');
    });
  });

  describe('Screenshot Validation (Section 4.5)', () => {
    it('validates allowed image formats and 2 MB size', () => {
      expect(validateScreenshot(null)).toBe('Payment screenshot is required');

      // Invalid MIME
      const pdfFile = new File(['%PDF'], 'slip.pdf', { type: 'application/pdf' });
      expect(validateScreenshot(pdfFile)).toBe('Only JPEG, PNG, or WebP images are allowed');

      // Valid types
      const jpegFile = new File(['fakeimg'], 'slip.jpg', { type: 'image/jpeg' });
      expect(validateScreenshot(jpegFile)).toBeNull();

      const pngFile = new File(['fakeimg'], 'slip.png', { type: 'image/png' });
      expect(validateScreenshot(pngFile)).toBeNull();

      const webpFile = new File(['fakeimg'], 'slip.webp', { type: 'image/webp' });
      expect(validateScreenshot(webpFile)).toBeNull();

      // Exceeding 2 MB
      const largeBytes = new Uint8Array(2 * 1024 * 1024 + 1);
      const largeFile = new File([largeBytes], 'huge.png', { type: 'image/png' });
      expect(validateScreenshot(largeFile)).toBe('Screenshot size must not exceed 2 MB');
    });
  });

  describe('Signed Currency Formatters & Accessible Labels (Requirement 12)', () => {
    it('formats credits with + sign, green flag, and accessible label', () => {
      const credit = formatSignedRupees('150.00');
      expect(credit.text).toBe('+Rs150.00');
      expect(credit.isCredit).toBe(true);
      expect(credit.accessibleLabel).toBe('Credit of Rs150.00');
    });

    it('formats debits with - sign, red flag, and accessible label', () => {
      const debit = formatSignedRupees('-50.00');
      expect(debit.text).toBe('-Rs50.00');
      expect(debit.isCredit).toBe(false);
      expect(debit.accessibleLabel).toBe('Debit of Rs50.00');
    });

    it('formats zero correctly', () => {
      const zero = formatSignedRupees('0.00');
      expect(zero.text).toBe('Rs0.00');
      expect(zero.accessibleLabel).toBe('Zero rupees');
    });

    it('formats large numbers with Indian thousand grouping', () => {
      const largeCredit = formatSignedRupees('125000.50');
      expect(largeCredit.text).toBe('+Rs1,25,000.50');

      const largeDebit = formatSignedRupees('-125000.50');
      expect(largeDebit.text).toBe('-Rs1,25,000.50');
    });
  });

  describe('parsePaiseSafe Utility', () => {
    it('parses paise without JavaScript float arithmetic errors', () => {
      expect(parsePaiseSafe('0.01')).toBe(1);
      expect(parsePaiseSafe('10.00')).toBe(1000);
      expect(parsePaiseSafe('19.99')).toBe(1999);
      expect(parsePaiseSafe('12500.50')).toBe(1250050);
      expect(parsePaiseSafe('-50.00')).toBe(-5000);
    });
  });
});
