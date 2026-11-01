import { describe, it, expect, vi } from 'vitest';
import {
  moneyStringSchema,
  signedMoneyStringSchema,
  walletsGuard,
  runGuard,
  paymentInfoDtoGuard,
} from '../src/api/guards.js';
import { getUserFriendlyErrorMessage } from '../src/api/errorMessages.js';
import { ApiError } from '../src/api/client.js';

describe('Requirement 5 & 6: User PWA Runtime Response Guards', () => {
  it('moneyStringSchema accepts valid 2-decimal money strings and rejects numbers', () => {
    expect(moneyStringSchema.safeParse('100.00').success).toBe(true);
    expect(moneyStringSchema.safeParse('0.00').success).toBe(true);
    expect(moneyStringSchema.safeParse('12345.67').success).toBe(true);

    // Numbers strictly fail the guard
    const numResult = moneyStringSchema.safeParse(100);
    expect(numResult.success).toBe(false);

    const floatResult = moneyStringSchema.safeParse(100.5);
    expect(floatResult.success).toBe(false);

    // Invalid formatting fails the guard
    expect(moneyStringSchema.safeParse('100').success).toBe(false);
    expect(moneyStringSchema.safeParse('100.5').success).toBe(false);
    expect(moneyStringSchema.safeParse('100.000').success).toBe(false);
  });

  it('signedMoneyStringSchema accepts signed and unsigned 2-decimal money strings', () => {
    expect(signedMoneyStringSchema.safeParse('50.00').success).toBe(true);
    expect(signedMoneyStringSchema.safeParse('+50.00').success).toBe(true);
    expect(signedMoneyStringSchema.safeParse('-50.00').success).toBe(true);

    // Number strictly fails
    expect(signedMoneyStringSchema.safeParse(-50).success).toBe(false);
    expect(signedMoneyStringSchema.safeParse(50.0).success).toBe(false);
  });

  it('walletsGuard fails when any balance is a number, preventing NaN or undefined rendering', () => {
    const rawWithNumber = {
      addMoney: 210.0, // Invalid: number instead of string
      cashback: '0.00',
      winning: '150.00',
      total: '360.00',
    };

    expect(() => {
      runGuard(walletsGuard, rawWithNumber, 'GET /api/v1/me');
    }).toThrow(ApiError);

    try {
      runGuard(walletsGuard, rawWithNumber, 'GET /api/v1/me');
    } catch (err: any) {
      expect(err.code).toBe('UNEXPECTED_RESPONSE');
      expect(err.message).toBe('unexpected response, please refresh');
      // Friendly message matches requirement exactly
      expect(getUserFriendlyErrorMessage(err.code)).toBe('unexpected response, please refresh');
    }
  });

  it('guards tolerate extra keys in production and pass them through', () => {
    const rawWithExtra = {
      configured: true,
      minDeposit: '10.00',
      maxDeposit: '5000.00',
      paymentUpiId: 'merchant@upi',
      extraUndocumentedField: 'ignored_in_prod',
    };

    const parsed = runGuard(paymentInfoDtoGuard, rawWithExtra, 'GET /api/v1/payment-info');
    expect(parsed.minDeposit).toBe('10.00');
    expect((parsed as any).extraUndocumentedField).toBe('ignored_in_prod');
  });

  it('in development mode, extra keys emit a dev warning with endpoint name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const rawWithExtra = {
      configured: true,
      minDeposit: '10.00',
      maxDeposit: '5000.00',
      paymentUpiId: 'merchant@upi',
      bonusFeature: true,
    };

    runGuard(paymentInfoDtoGuard, rawWithExtra, 'GET /api/v1/payment-info');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API Guard DEV Warning] Endpoint GET /api/v1/payment-info contains extra undocumented keys: bonusFeature')
    );

    warnSpy.mockRestore();
  });
});
