import { ErrorCodes, type ErrorCode } from '@booyah/shared';

/**
 * Friendly User Message Table for all Section 22 Error Codes
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCodes.UNAUTHENTICATED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.SESSION_REPLACED]: 'You were logged out because your account was used on another device.',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCodes.ADMIN_APPROVAL_REQUIRED]: 'This transaction requires administrator review.',
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your inputs and try again.',
  [ErrorCodes.INVALID_OTP]: 'Invalid or expired OTP code. Please check the code or request a new one.',
  [ErrorCodes.OTP_RATE_LIMITED]: 'Too many OTP requests. Please wait a few moments before requesting another.',
  [ErrorCodes.EMAIL_EXISTS]: 'This email is already registered. Please log in instead.',
  [ErrorCodes.MOBILE_EXISTS]: 'This mobile number is already linked to another account.',
  [ErrorCodes.FF_ID_EXISTS]: 'This Free Fire ID is already registered to another player.',
  [ErrorCodes.UPI_EXISTS]: 'This UPI ID is already registered to another account.',
  [ErrorCodes.INVALID_REFERRAL]: 'Invalid referral code. Please check the code or leave it blank.',
  [ErrorCodes.FIELD_COOLDOWN]: 'This field was changed recently and cannot be updated yet.',
  [ErrorCodes.IN_ACTIVE_MATCH]: 'You cannot modify profile details while enrolled in an upcoming or live match.',
  [ErrorCodes.LOW_BALANCE]: 'Insufficient wallet balance. Please add money to continue.',
  [ErrorCodes.UTR_EXISTS]: 'This transaction UTR has already been submitted.',
  [ErrorCodes.DEPOSIT_LIMIT]: 'Deposit amount is outside the allowed limits.',
  [ErrorCodes.WITHDRAWAL_PENDING]: 'You already have a pending withdrawal request in progress.',
  [ErrorCodes.UPI_RECENTLY_CHANGED]: 'Withdrawals are locked for 48 hours following a UPI ID change.',
  [ErrorCodes.MATCH_FULL]: 'This match is full. Please browse other available matches.',
  [ErrorCodes.ALREADY_JOINED]: 'You have already joined this match.',
  [ErrorCodes.MATCH_NOT_JOINABLE]: 'This match is no longer accepting new players.',
  [ErrorCodes.TEAM_INVALID]: 'Invalid team configuration or player roster.',
  [ErrorCodes.INVITE_EXPIRED]: 'This team invitation has expired.',
  [ErrorCodes.RESULT_INVALID]: 'The submitted match results are invalid.',
  [ErrorCodes.RESULT_LOCKED]: 'Match results have been approved and locked.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please slow down and try again shortly.',
  [ErrorCodes.INTERNAL_ERROR]: 'An unexpected system error occurred. Please try again.',
  [ErrorCodes.INVALID_TRANSITION]: 'This match action cannot be performed in its current status.',
  [ErrorCodes.DATABASE_BUSY]: 'The server is temporarily busy. Please retry in a few seconds.',
  [ErrorCodes.ADMINS_APPROVE_DIRECTLY]: 'Admins approve directly',
  [ErrorCodes.MAINTENANCE_MODE]: 'The platform is currently undergoing scheduled maintenance. Please try again shortly.',
};

export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';
export const PROD_NETWORK_OR_NON_JSON_MESSAGE = "We couldn't reach the server. Please check your connection and try again.";
export const DEV_NETWORK_MESSAGE = 'Cannot reach the server. Check that the API is running.';
export const DEV_NON_JSON_MESSAGE = 'The server sent an unexpected response.';

export function getUserFriendlyErrorMessage(
  code?: string | null,
  isDev: boolean = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)
): string {
  if (!code) return DEFAULT_ERROR_MESSAGE;
  if (code === 'UNEXPECTED_RESPONSE') return 'unexpected response, please refresh';

  if (code === 'NETWORK_ERROR') {
    return isDev ? DEV_NETWORK_MESSAGE : PROD_NETWORK_OR_NON_JSON_MESSAGE;
  }

  if (code === 'NON_JSON_RESPONSE' || code === 'SERVER_UNAVAILABLE') {
    return isDev ? DEV_NON_JSON_MESSAGE : PROD_NETWORK_OR_NON_JSON_MESSAGE;
  }

  const mapped = ERROR_MESSAGES[code as ErrorCode];
  return mapped || DEFAULT_ERROR_MESSAGE;
}
