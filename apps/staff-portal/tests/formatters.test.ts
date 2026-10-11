import { describe, it, expect } from 'vitest';
import {
  formatIndianRupees,
  formatISTDate,
  formatAgeMinutes,
  isDepositOverdue,
  isWithdrawalOverdue,
} from '../src/utils/formatters';

describe('Requirement 6 & Formatters: Age, Decimal Boundaries, Money & IST', () => {
  describe('Deposit Overdue Exact Boundary (strictly > 30 minutes)', () => {
    it('returns false for exactly 30 minutes', () => {
      expect(isDepositOverdue(30)).toBe(false);
      expect(isDepositOverdue(30.0)).toBe(false);
    });

    it('returns true for 30.01 minutes', () => {
      expect(isDepositOverdue(30.01)).toBe(true);
      expect(isDepositOverdue(30.001)).toBe(true);
      expect(isDepositOverdue(31)).toBe(true);
    });

    it('returns false for under 30 minutes', () => {
      expect(isDepositOverdue(29.99)).toBe(false);
      expect(isDepositOverdue(0)).toBe(false);
      expect(isDepositOverdue(-5)).toBe(false);
    });

    it('handles null and undefined safely without throwing', () => {
      expect(isDepositOverdue(null)).toBe(false);
      expect(isDepositOverdue(undefined)).toBe(false);
    });
  });

  describe('Withdrawal Overdue Exact Boundary (strictly > 1440 minutes)', () => {
    it('returns false for exactly 1440 minutes (24 hours)', () => {
      expect(isWithdrawalOverdue(1440)).toBe(false);
      expect(isWithdrawalOverdue(1440.0)).toBe(false);
    });

    it('returns true for 1440.01 minutes', () => {
      expect(isWithdrawalOverdue(1440.01)).toBe(true);
      expect(isWithdrawalOverdue(1440.1)).toBe(true);
      expect(isWithdrawalOverdue(1441)).toBe(true);
    });

    it('returns false for under 1440 minutes', () => {
      expect(isWithdrawalOverdue(1439.99)).toBe(false);
      expect(isWithdrawalOverdue(120)).toBe(false);
      expect(isWithdrawalOverdue(0)).toBe(false);
    });

    it('handles null and undefined safely without throwing', () => {
      expect(isWithdrawalOverdue(null)).toBe(false);
      expect(isWithdrawalOverdue(undefined)).toBe(false);
    });
  });

  describe('formatAgeMinutes (handles decimals, hours, and null)', () => {
    it('formats null and undefined as em-dash', () => {
      expect(formatAgeMinutes(null)).toBe('—');
      expect(formatAgeMinutes(undefined)).toBe('—');
    });

    it('formats decimal minutes below an hour', () => {
      expect(formatAgeMinutes(0)).toBe('0m');
      expect(formatAgeMinutes(12.4)).toBe('12.4m');
      expect(formatAgeMinutes(30.01)).toBe('30m');
      expect(formatAgeMinutes(45.5)).toBe('45.5m');
    });

    it('formats hours and remaining minutes', () => {
      expect(formatAgeMinutes(60)).toBe('1h');
      expect(formatAgeMinutes(90)).toBe('1h 30m');
      expect(formatAgeMinutes(1440)).toBe('24h');
      expect(formatAgeMinutes(1445.5)).toBe('24h 5m');
    });
  });

  describe('formatIndianRupees (string-based, no floating point conversion)', () => {
    it('formats zero and empty values as Rs0.00', () => {
      expect(formatIndianRupees('')).toBe('Rs0.00');
      expect(formatIndianRupees(null)).toBe('Rs0.00');
      expect(formatIndianRupees(undefined)).toBe('Rs0.00');
      expect(formatIndianRupees('0')).toBe('Rs0.00');
      expect(formatIndianRupees('0.00')).toBe('Rs0.00');
    });

    it('formats whole and decimal amounts with Indian lakh/crore commas', () => {
      expect(formatIndianRupees('50.00')).toBe('Rs50.00');
      expect(formatIndianRupees('500.50')).toBe('Rs500.50');
      expect(formatIndianRupees('1000.00')).toBe('Rs1,000.00');
      expect(formatIndianRupees('15000.00')).toBe('Rs15,000.00');
      expect(formatIndianRupees('100000.00')).toBe('Rs1,00,000.00');
      expect(formatIndianRupees('10000000.00')).toBe('Rs1,00,00,000.00');
    });

    it('pads single decimal digits', () => {
      expect(formatIndianRupees('25.5')).toBe('Rs25.50');
    });
  });

  describe('formatISTDate', () => {
    it('handles null and invalid dates', () => {
      expect(formatISTDate(null)).toBe('—');
      expect(formatISTDate(undefined)).toBe('—');
      expect(formatISTDate('invalid-date')).toBe('—');
    });

    it('formats UTC ISO date into IST (UTC + 05:30)', () => {
      const utcIso = '2026-10-11T06:00:00.000Z'; // 11:30 AM IST
      const formatted = formatISTDate(utcIso);
      expect(formatted).toContain('11');
      expect(formatted).toContain('Oct');
      expect(formatted).toContain('2026');
      expect(formatted).toMatch(/11:30\s*(AM|am)/i);
    });
  });
});
