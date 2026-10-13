/**
 * Friendly error messages for Booyah Win Staff Portal
 *
 * Requirements:
 * - Requirement 3: Show ONLY the portal's own friendly messages chosen by error CODE,
 *   never the server's message text.
 * - A 409 shows "This request was already processed".
 * - Requirement 5: Clear display of FORBIDDEN self-processing and ADMIN_APPROVAL_REQUIRED.
 */

import { ErrorCodes } from '@booyah/shared';
import { ApiError } from '../api/client.js';

export const PROD_NETWORK_OR_NON_JSON_MESSAGE = "We couldn't reach the server. Please check your connection and try again.";
export const DEV_NETWORK_MESSAGE = 'Cannot reach the server. Check that the API is running.';
export const DEV_NON_JSON_MESSAGE = 'The server sent an unexpected response.';

export const ERROR_CODE_MESSAGES: Record<string, string> = {
  UNEXPECTED_RESPONSE: 'unexpected response, please refresh',
  [ErrorCodes.ADMIN_APPROVAL_REQUIRED]: 'This request requires admin approval',
  [ErrorCodes.FORBIDDEN]: 'Action not permitted.',
  [ErrorCodes.UNAUTHENTICATED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.SESSION_REPLACED]: 'You were logged out because your account was used on another device.',
  [ErrorCodes.INVALID_OTP]: 'Invalid OTP code. Please check the code and try again.',
  [ErrorCodes.OTP_RATE_LIMITED]: 'Too many OTP requests. Please wait before trying again.',
  [ErrorCodes.VALIDATION_ERROR]: 'Please verify your input before submitting.',
  [ErrorCodes.NOT_FOUND]: 'The requested record could not be found.',
  [ErrorCodes.DATABASE_BUSY]: 'System is currently busy. Please retry in a few seconds.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please slow down.',
  [ErrorCodes.RESULT_INVALID]: 'Result submission is invalid. Please verify player kills and positions.',
  [ErrorCodes.RESULT_LOCKED]: 'This match result has already been approved and is locked.',
  [ErrorCodes.INVALID_TRANSITION]: 'This action cannot be performed for the match in its current state.',
  [ErrorCodes.MATCH_NOT_JOINABLE]: 'The match is no longer open for joining.',
  [ErrorCodes.MATCH_FULL]: 'The match has reached maximum player capacity.',
  [ErrorCodes.LOW_BALANCE]: 'Insufficient wallet balance for this operation.',
  [ErrorCodes.EMAIL_EXISTS]: 'An account with this email address already exists.',
  [ErrorCodes.ADMINS_APPROVE_DIRECTLY]: 'Admins approve directly',
  [ErrorCodes.MAINTENANCE_MODE]: 'System is currently in maintenance mode. Mutating actions are temporarily restricted.',
  NETWORK_ERROR: DEV_NETWORK_MESSAGE,
  NON_JSON_RESPONSE: DEV_NON_JSON_MESSAGE,
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  SERVER_UNAVAILABLE: 'Server is temporarily unavailable. Please try again shortly.',
};

/**
 * Returns a friendly, client-chosen error message based on error code and status.
 * Never displays raw server message strings to the user.
 */
export function getFriendlyErrorMessage(
  err: unknown,
  context?: 'deposit' | 'withdrawal' | 'result' | 'cancel' | 'live' | 'employee' | 'tier' | 'user' | 'settings' | 'audit',
  isDev: boolean = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)
): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK_ERROR') {
      return isDev ? DEV_NETWORK_MESSAGE : PROD_NETWORK_OR_NON_JSON_MESSAGE;
    }

    if (err.code === 'NON_JSON_RESPONSE') {
      return isDev ? DEV_NON_JSON_MESSAGE : PROD_NETWORK_OR_NON_JSON_MESSAGE;
    }

    if (err.code === 'UNEXPECTED_RESPONSE' || err.message === 'unexpected response, please refresh') {
      return 'unexpected response, please refresh';
    }

    if (err.code === ErrorCodes.EMAIL_EXISTS) {
      return 'An account with this email address already exists.';
    }

    // 409 conflict
    if (err.status === 409) {
      if (context === 'tier') {
        return 'An active entry tier with this mode, team mode, and fee already exists.';
      }
      if (context === 'user' && err.code === ErrorCodes.INVALID_TRANSITION) {
        return 'This user account is already deleted.';
      }
      return 'This request was already processed';
    }

    // Specific context for self-processing or permissions
    if (err.code === ErrorCodes.FORBIDDEN) {
      if (context === 'deposit') {
        return 'Staff cannot approve their own deposit';
      }
      if (context === 'withdrawal') {
        return 'Staff cannot mark their own withdrawal as paid';
      }
      if (context === 'result') {
        return 'Staff members cannot submit or process results for matches they participated in.';
      }
      if (context === 'cancel') {
        return 'Only administrators can cancel a live match.';
      }
      if (context === 'live') {
        return 'Match is underfilled. Matches cannot go live until minimum players requirement is fulfilled.';
      }
      if (context === 'employee') {
        return 'Administrators cannot delete their own account.';
      }
      return 'Action not permitted.';
    }

    if (context === 'live' && err.code === ErrorCodes.INVALID_TRANSITION) {
      return err.message && err.message.toLowerCase().includes('requires')
        ? err.message
        : 'Match cannot go live until the minimum player requirement is fulfilled.';
    }

    if (err.code === ErrorCodes.LOW_BALANCE) {
      if (context === 'user') {
        return 'Adjustment rejected: insufficient wallet balance.';
      }
      return 'Cannot reverse result: one or more players have insufficient winning balance.';
    }

    if (err.code === ErrorCodes.ADMIN_APPROVAL_REQUIRED) {
      if (context === 'withdrawal') {
        return 'This withdrawal requires admin approval to mark as paid';
      }
      return 'This deposit requires admin approval';
    }

    if (err.code === ErrorCodes.RATE_LIMITED && context === 'user') {
      return 'Daily user detail view limit reached (300 views/day). Contact administrator if you need an increase.';
    }

    if (ERROR_CODE_MESSAGES[err.code]) {
      return ERROR_CODE_MESSAGES[err.code];
    }
  }

  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return isDev ? DEV_NETWORK_MESSAGE : PROD_NETWORK_OR_NON_JSON_MESSAGE;
  }

  return 'An unexpected error occurred. Please try again.';
}
