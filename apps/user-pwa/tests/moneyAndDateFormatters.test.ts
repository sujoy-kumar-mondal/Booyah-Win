import { describe, it, expect } from 'vitest';
import {
  formatIndianRupees,
  formatISTDateTime,
  formatWeekRange,
  formatDateOfBirth,
  formatSignedRupees,
} from '../src/utils/formatters.js';
import en from '../src/locales/en.json';
import bn from '../src/locales/bn.json';

describe('Requirement 3 & 7: Money, Date Formatters & Untranslated Brand Tokens', () => {
  describe('Money Formatting: Latin Digits, No Floats & Pure String Manipulation', () => {
    it('formats rupee amounts with Latin digits, Rs prefix and two decimals', () => {
      expect(formatIndianRupees('0.00')).toBe('Rs0.00');
      expect(formatIndianRupees('50.00')).toBe('Rs50.00');
      expect(formatIndianRupees('100.50')).toBe('Rs100.50');
      expect(formatIndianRupees('1500.00')).toBe('Rs1,500.00');
      expect(formatIndianRupees('100000.00')).toBe('Rs1,00,000.00');
    });

    it('handles null, undefined and negative values gracefully', () => {
      expect(formatIndianRupees(null)).toBe('Rs0.00');
      expect(formatIndianRupees(undefined)).toBe('Rs0.00');
      expect(formatIndianRupees('-50.00')).toBe('-Rs50.00');
      expect(formatIndianRupees('-125000.00')).toBe('-Rs1,25,000.00');
    });

    it('ensures formatted amounts contain ONLY Latin digits (0-9) and no Bengali numerals (০-৯)', () => {
      const formatted = formatIndianRupees('9876543.21');
      expect(formatted).toBe('Rs98,76,543.21');
      // No Bengali numerals
      expect(/[০-৯]/.test(formatted)).toBe(false);
      // Strictly Latin digits
      expect(/Rs[\d,]+\.\d{2}/.test(formatted)).toBe(true);
    });

    it('formatSignedRupees carries +/- sign with accessible label', () => {
      const credit = formatSignedRupees('50.00');
      expect(credit.text).toBe('+Rs50.00');
      expect(credit.isCredit).toBe(true);
      expect(credit.accessibleLabel).toBe('Credit of Rs50.00');

      const debit = formatSignedRupees('-20.00');
      expect(debit.text).toBe('-Rs20.00');
      expect(debit.isCredit).toBe(false);
      expect(debit.accessibleLabel).toBe('Debit of Rs20.00');
    });
  });

  describe('Date & Time Formatting: IST Timezone & Latin Digits', () => {
    it('formats ISO timestamps to IST with Latin digits', () => {
      // 2026-10-15T12:30:00Z is 18:00 (06:00 PM) IST
      const istString = formatISTDateTime('2026-10-15T12:30:00Z');
      expect(istString).toContain('15 Oct 2026');
      expect(istString).toContain('06:00 PM');
      // Must contain Latin digits, zero Bengali digits
      expect(/[০-৯]/.test(istString)).toBe(false);
      expect(/[0-9]/.test(istString)).toBe(true);
    });

    it('formatWeekRange formats date intervals in IST with Latin digits', () => {
      const range = formatWeekRange('2026-10-12T00:00:00Z', '2026-10-18T23:59:59Z');
      expect(range).toContain('IST');
      expect(/[০-৯]/.test(range)).toBe(false);
      expect(/[0-9]/.test(range)).toBe(true);
    });

    it('formatDateOfBirth produces clean date with Latin digits', () => {
      const dob = formatDateOfBirth('2000-01-15');
      expect(dob).toBe('15 Jan 2000');
      expect(/[০-৯]/.test(dob)).toBe(false);
    });
  });

  describe('Untranslated Platform & Game Tokens', () => {
    const requiredUntranslatedTokens = [
      'Booyah Win',
      'Free Fire',
      'UTR',
      'UPI',
      'OTP',
    ];

    it('preserves untranslated tokens in English dictionary', () => {
      const enJsonString = JSON.stringify(en);
      for (const token of requiredUntranslatedTokens) {
        expect(enJsonString).toContain(token);
      }
    });

    it('preserves untranslated tokens in Bengali dictionary verbatim', () => {
      const bnJsonString = JSON.stringify(bn);
      for (const token of requiredUntranslatedTokens) {
        expect(bnJsonString, `Token "${token}" must not be translated into Bengali`).toContain(token);
      }
    });
  });
});
