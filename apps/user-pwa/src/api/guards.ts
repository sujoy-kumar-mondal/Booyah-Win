/**
 * Runtime Response Guards for Booyah Win User PWA
 *
 * Requirements 4, 5, 6:
 * - Money fields must be strings matching ^\d+\.\d{2}$ (signed ^[+-]?\d+\.\d{2}$ for transaction amounts).
 *   A number in a money field FAILS the guard.
 * - Guards require documented keys and types, but tolerate extra keys in production.
 * - In development, extra keys or missing keys without values log a warning naming the endpoint and keys.
 * - In production, a guard failure throws ApiError with message "unexpected response, please refresh".
 * - A failure on a money field never renders a number, undefined, or NaN.
 */

import { z } from 'zod';
import { ApiError } from './client.js';

// ─── Money Schemas ────────────────────────────────────────────────────────────
export const moneyStringSchema = z
  .string({
    required_error: 'Money string is required',
    invalid_type_error: 'Money field must be a string, numbers are strictly prohibited',
  })
  .regex(/^\d+\.\d{2}$/, 'Money field must be a 2-decimal formatted string matching ^\\d+\\.\\d{2}$');

export const signedMoneyStringSchema = z
  .string({
    required_error: 'Signed money string is required',
    invalid_type_error: 'Signed money field must be a string, numbers are strictly prohibited',
  })
  .regex(/^[+-]?\d+\.\d{2}$/, 'Signed money field must match ^[+-]?\\d+\\.\\d{2}$');

// ─── Dev Warning Key Inspector ────────────────────────────────────────────────
function inspectKeys(schema: z.ZodTypeAny, data: any, endpointName: string) {
  if (typeof data !== 'object' || data === null) return;
  if (Array.isArray(data)) {
    data.forEach((item) => inspectKeys(schema, item, endpointName));
    return;
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const expectedKeys = new Set(Object.keys(shape));
    const actualKeys = Object.keys(data);

    const extraKeys = actualKeys.filter((k) => !expectedKeys.has(k));
    if (extraKeys.length > 0) {
      console.warn(
        `[API Guard DEV Warning] Endpoint ${endpointName} contains extra undocumented keys: ${extraKeys.join(', ')}`
      );
    }

    for (const key of expectedKeys) {
      if (data[key] === undefined && !shape[key].isOptional()) {
        console.warn(
          `[API Guard DEV Warning] Endpoint ${endpointName} missing required key without value: ${key}`
        );
      }
    }
  }
}

// ─── Guard Validation Runner ──────────────────────────────────────────────────
export function runGuard<T>(schema: z.ZodType<T>, rawData: unknown, endpointName: string): T {
  const isProd =
    typeof globalThis !== 'undefined' && (globalThis as any).process
      ? (globalThis as any).process.env?.NODE_ENV === 'production'
      : (import.meta as any)?.env?.PROD ?? false;

  if (!isProd) {
    inspectKeys(schema, rawData, endpointName);
  }

  const parseResult = schema.safeParse(rawData);
  if (!parseResult.success) {
    if (!isProd) {
      console.warn(
        `[API Guard DEV Warning] Validation failed for ${endpointName}:`,
        parseResult.error.issues
      );
    }
    throw new ApiError(
      'UNEXPECTED_RESPONSE',
      'unexpected response, please refresh',
      { issues: isProd ? undefined : parseResult.error.issues },
      500
    );
  }

  return parseResult.data;
}

// ─── 1. User Profile & Auth Schemas ───────────────────────────────────────────
export const userProfileGuard = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  mobile: z.string(),
  ffId: z.string(),
  ffName: z.string(),
  upiId: z.string(),
  dateOfBirth: z.string(),
  referralCode: z.string(),
  referredBy: z.string().nullable().optional(),
  createdAt: z.string(),
}).passthrough();

export const walletsGuard = z.object({
  addMoney: moneyStringSchema,
  cashback: moneyStringSchema,
  winning: moneyStringSchema,
  total: moneyStringSchema,
}).passthrough();

export const cooldownsGuard = z.object({
  mobileAvailableAt: z.string().nullable().optional(),
  ffIdAvailableAt: z.string().nullable().optional(),
  ffNameAvailableAt: z.string().nullable().optional(),
  upiIdAvailableAt: z.string().nullable().optional(),
}).passthrough();

export const getMeGuard = z.object({
  profile: userProfileGuard,
  wallets: walletsGuard,
  cooldowns: cooldownsGuard,
}).passthrough();

export const loginVerifyResponseGuard = z.object({
  token: z.string(),
  user: userProfileGuard,
}).passthrough();

export const registerVerifyResponseGuard = z.object({
  registrationToken: z.string(),
}).passthrough();

export const registerCompleteResponseGuard = z.object({
  token: z.string(),
  user: userProfileGuard,
}).passthrough();

// ─── 2. Payment & Wallet Schemas ──────────────────────────────────────────────
export const paymentInfoDtoGuard = z.object({
  configured: z.boolean(),
  paymentUpiId: z.string().nullable().optional(),
  paymentQrUrl: z.string().nullable().optional(),
  qrUrl: z.string().nullable().optional(),
  minDeposit: moneyStringSchema,
  maxDeposit: moneyStringSchema,
  message: z.string().optional(),
}).passthrough();

export const depositDtoGuard = z.object({
  id: z.string(),
  amount: moneyStringSchema,
  utr: z.string(),
  screenshotUrl: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  rejectReason: z.string().nullable().optional(),
  needsAdmin: z.boolean(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
}).passthrough();

export const depositListResponseGuard = z.object({
  items: z.array(depositDtoGuard),
  nextCursor: z.string().nullable().optional(),
}).passthrough();

export const withdrawalDtoGuard = z.object({
  id: z.string(),
  amount: moneyStringSchema,
  upiId: z.string(),
  status: z.enum(['pending', 'paid', 'rejected']),
  rejectReason: z.string().nullable().optional(),
  payoutRef: z.string().nullable().optional(),
  createdAt: z.string(),
  processedAt: z.string().nullable().optional(),
}).passthrough();

export const withdrawalListResponseGuard = z.object({
  items: z.array(withdrawalDtoGuard),
  nextCursor: z.string().nullable().optional(),
}).passthrough();

export const transactionDtoGuard = z.object({
  transactionId: z.string(),
  type: z.string(),
  createdAt: z.string(),
  amount: signedMoneyStringSchema,
  remainingAmount: moneyStringSchema,
  wallet: z.string(),
  refType: z.string().nullable().optional(),
  refId: z.string().nullable().optional(),
}).passthrough();

export const transactionListResponseGuard = z.object({
  items: z.array(transactionDtoGuard),
  nextCursor: z.string().nullable().optional(),
}).passthrough();
