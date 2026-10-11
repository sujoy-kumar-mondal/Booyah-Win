import { describe, it, expect } from 'vitest';
import { ErrorCodes } from '@booyah/shared';
import { ERROR_MESSAGES, getUserFriendlyErrorMessage, DEFAULT_ERROR_MESSAGE } from '../src/api/errorMessages.js';

describe('Error Code Message Table (Section 22 Coverage)', () => {
  it('covers every error code defined in @booyah/shared ErrorCodes with a friendly message', () => {
    const allCodes = Object.values(ErrorCodes);
    expect(allCodes.length).toBeGreaterThan(0);

    for (const code of allCodes) {
      const message = ERROR_MESSAGES[code];
      expect(
        message,
        `Error code "${code}" from @booyah/shared is missing a friendly message in ERROR_MESSAGES table`
      ).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(5);
    }
  });

  it('getUserFriendlyErrorMessage returns mapped message for known codes', () => {
    expect(getUserFriendlyErrorMessage(ErrorCodes.SESSION_REPLACED)).toBe(
      'You were logged out because your account was used on another device.'
    );
    expect(getUserFriendlyErrorMessage(ErrorCodes.LOW_BALANCE)).toBe(
      'Insufficient wallet balance. Please add money to continue.'
    );
  });

  it('falls back to friendly generic message for null, undefined, or unknown codes without revealing server details', () => {
    expect(getUserFriendlyErrorMessage('RANDOM_UNKNOWN_CODE')).toBe(DEFAULT_ERROR_MESSAGE);
    expect(getUserFriendlyErrorMessage(null)).toBe(DEFAULT_ERROR_MESSAGE);
    expect(getUserFriendlyErrorMessage(undefined)).toBe(DEFAULT_ERROR_MESSAGE);
  });
});
