import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateName,
  validateMobile,
  validateFfId,
  validateFfName,
  validateUpiId,
  validateDateOfBirth,
  validateReferralCode,
} from '../src/utils/validation.js';

describe('Client-Side Validation Rules (Section 4.5)', () => {
  it('validates email format', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('test.player+ff@domain.co.in')).toBeNull();
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address');
    expect(validateEmail('user@')).toBe('Enter a valid email address');
  });

  it('validates full name (2-60 chars, letters/dots/spaces)', () => {
    expect(validateName('John Doe')).toBeNull();
    expect(validateName('A. B. Sen')).toBeNull();
    expect(validateName('')).toBe('Full name is required');
    expect(validateName('A')).toBe('Name must be between 2 and 60 characters');
    expect(validateName('John123')).toBe('Name can only contain letters, spaces, and dots');
    expect(validateName('John_Doe')).toBe('Name can only contain letters, spaces, and dots');
  });

  it('validates 10-digit Indian mobile numbers (starts with 6-9)', () => {
    expect(validateMobile('9876543210')).toBeNull();
    expect(validateMobile('8123456789')).toBeNull();
    expect(validateMobile('7000000000')).toBeNull();
    expect(validateMobile('6999999999')).toBeNull();

    expect(validateMobile('')).toBe('Mobile number is required');
    expect(validateMobile('5876543210')).toBe('Enter a valid 10-digit Indian mobile number');
    expect(validateMobile('987654321')).toBe('Enter a valid 10-digit Indian mobile number'); // 9 digits
    expect(validateMobile('98765432100')).toBe('Enter a valid 10-digit Indian mobile number'); // 11 digits
    expect(validateMobile('98765abcde')).toBe('Enter a valid 10-digit Indian mobile number');
  });

  it('validates Free Fire ID (digits only, length 6-15)', () => {
    expect(validateFfId('123456')).toBeNull();
    expect(validateFfId('123456789012345')).toBeNull();

    expect(validateFfId('')).toBe('Free Fire ID is required');
    expect(validateFfId('12345')).toBe('Free Fire ID must be between 6 and 15 digits');
    expect(validateFfId('1234567890123456')).toBe('Free Fire ID must be between 6 and 15 digits');
    expect(validateFfId('ff123456')).toBe('Free Fire ID must be between 6 and 15 digits');
  });

  it('validates Free Fire In-Game Name (1-30 chars)', () => {
    expect(validateFfName('Pro_Killer')).toBeNull();
    expect(validateFfName('')).toBe('Free Fire In-Game Name is required');
    expect(validateFfName('a'.repeat(31))).toBe('Free Fire Name must be between 1 and 30 characters');
  });

  it('validates UPI ID format', () => {
    expect(validateUpiId('player@okhdfcbank')).toBeNull();
    expect(validateUpiId('gamer.99@paytm')).toBeNull();
    expect(validateUpiId('user_123@axisbank')).toBeNull();

    expect(validateUpiId('')).toBe('UPI ID is required');
    expect(validateUpiId('invalid-upi')).toBe('Enter a valid UPI ID (e.g. player@upi)');
    expect(validateUpiId('@paytm')).toBe('Enter a valid UPI ID (e.g. player@upi)');
    expect(validateUpiId('player@')).toBe('Enter a valid UPI ID (e.g. player@upi)');
  });

  it('validates date of birth requires 18+ years', () => {
    const today = new Date();
    // Exactly 20 years ago -> valid
    const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate())
      .toISOString()
      .split('T')[0];
    expect(validateDateOfBirth(twentyYearsAgo)).toBeNull();

    // 16 years ago -> invalid
    const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate())
      .toISOString()
      .split('T')[0];
    expect(validateDateOfBirth(sixteenYearsAgo)).toBe('You must be at least 18 years old to participate');

    expect(validateDateOfBirth('')).toBe('Date of birth is required');
    expect(validateDateOfBirth('not-a-date')).toBe('Invalid date format');
  });

  it('validates optional referral code', () => {
    expect(validateReferralCode('')).toBeNull();
    expect(validateReferralCode(undefined)).toBeNull();
    expect(validateReferralCode('REF12345')).toBeNull();
    expect(validateReferralCode('ABC')).toBe('Referral code must be between 4 and 20 characters');
  });
});
