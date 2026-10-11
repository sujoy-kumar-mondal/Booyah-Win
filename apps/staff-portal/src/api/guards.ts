/**
 * Runtime Response Guards for Booyah Win Staff Portal
 *
 * Requirements 4, 5, 6:
 * - Money fields must be strings matching ^\d+\.\d{2}$ (signed ^[+-]?\d+\.\d{2}$ for difference/balance).
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
    typeof process !== 'undefined'
      ? process.env.NODE_ENV === 'production'
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

// ─── 1. Staff Profile & Auth Schemas ──────────────────────────────────────────
export const staffDtoGuard = z.object({
  id: z.string(),
  role: z.enum(['employee', 'admin']),
  name: z.string(),
  email: z.string(),
  mobile: z.string(),
  createdAt: z.string().optional(),
}).passthrough();

export const staffMeGuard = z.object({
  profile: staffDtoGuard,
}).passthrough();

export const staffLoginResponseGuard = z.object({
  token: z.string(),
  staff: staffDtoGuard,
}).passthrough();

export const dashboardMetricsGuard = z.object({
  pendingDepositsCount: z.number().int(),
  oldestPendingDepositAgeMinutes: z.number().nullable(),
  isOldestDepositOver30Min: z.boolean(),
  pendingWithdrawalsCount: z.number().int(),
  oldestPendingWithdrawalAgeMinutes: z.number().nullable(),
  liveMatchesCount: z.number().int(),
  upcomingMatchesCount: z.number().int(),
  roomOpenMatchesCount: z.number().int(),
  completedMatchesCount: z.number().int(),
  resultsWaitingApprovalCount: z.number().int(),
}).passthrough();

// ─── 2. Entry Tiers Guard ─────────────────────────────────────────────────────
export const tierPositionGuard = z.object({
  position: z.number(),
  prize: moneyStringSchema,
}).passthrough();

export const entryTierGuard = z.object({
  id: z.string(),
  gameMode: z.enum(['battle_royale', 'clash_squad']),
  teamMode: z.enum(['solo', 'duo', 'squad']),
  entryFee: moneyStringSchema,
  killPrice: moneyStringSchema,
  minKillsForReward: z.number(),
  maxPlayers: z.number(),
  minPlayers: z.number(),
  positions: z.array(tierPositionGuard),
  createdAt: z.string(),
}).passthrough();

export const entryTiersResponseGuard = z.object({
  tiers: z.array(entryTierGuard),
}).passthrough();

// ─── 3. Match List & Match Detail Guards ──────────────────────────────────────
export const matchStaffDtoGuard = z.object({
  id: z.string(),
  tierId: z.string(),
  gameMode: z.enum(['battle_royale', 'clash_squad']),
  teamMode: z.enum(['solo', 'duo', 'squad']),
  entryFee: moneyStringSchema,
  killPrice: moneyStringSchema,
  minKillsForReward: z.number(),
  positionPrizes: z.record(z.string(), moneyStringSchema),
  maxPlayers: z.number(),
  minPlayers: z.number(),
  startTime: z.string(),
  roomId: z.string().nullable().optional(),
  roomPassword: z.string().nullable().optional(),
  status: z.enum(['upcoming', 'room_open', 'live', 'completed', 'cancelled']),
  cancelReason: z.string().nullable().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  joinedCount: z.number(),
  seatsTaken: z.number().optional(),
}).passthrough();

export const matchListResponseGuard = z.object({
  matches: z.array(matchStaffDtoGuard),
  nextCursor: z.string().nullable().optional(),
}).passthrough();

export const joinedPlayerGuard = z.object({
  userId: z.string(),
  name: z.string(),
  ffId: z.string(),
  ffName: z.string(),
  teamId: z.string().nullable(),
  paidAddMoney: moneyStringSchema,
  paidCashback: moneyStringSchema,
  paidWinning: moneyStringSchema,
  refundedAt: z.string().nullable(),
  joinedAt: z.string(),
}).passthrough();

export const matchTeamStaffGuard = z.object({
  id: z.string(),
  name: z.string().nullable(),
  size: z.number(),
  status: z.enum(['forming', 'confirmed', 'disbanded']),
  leaderId: z.string(),
  memberUserIds: z.array(z.string()),
}).passthrough();

export const matchDetailResponseGuard = z.object({
  match: matchStaffDtoGuard.extend({
    players: z.array(joinedPlayerGuard),
    teams: z.array(matchTeamStaffGuard),
  }).passthrough(),
}).passthrough();

// ─── 4. Results & Payout Preview Guards ───────────────────────────────────────
export const resultEntryGuard = z.object({
  userId: z.string(),
  kills: z.number(),
  position: z.number().nullable(),
}).passthrough();

export const matchResultStaffGuard = z.object({
  id: z.string(),
  matchId: z.string(),
  entries: z.array(resultEntryGuard),
  screenshotUrl: z.string(),
  signedScreenshotUrl: z.string().optional(),
  status: z.enum(['pending_approval', 'approved', 'rejected']),
  rejectReason: z.string().nullable().optional(),
  submittedBy: z.string(),
  approvedBy: z.string().nullable().optional(),
  createdAt: z.string(),
  approvedAt: z.string().nullable().optional(),
}).passthrough();

export const adminQueueItemGuard = z.object({
  id: z.string(),
  matchId: z.string(),
  status: z.string(),
  submittedBy: z.string(),
  createdAt: z.string(),
  screenshotUrl: z.string(),
  gameMode: z.string(),
  teamMode: z.string(),
  matchStatus: z.string(),
}).passthrough();

export const adminQueueResponseGuard = z.object({
  results: z.array(adminQueueItemGuard),
  count: z.number(),
}).passthrough();

export const payoutPreviewEntryGuard = z.object({
  userId: z.string(),
  kills: z.number(),
  position: z.number().nullable(),
  killReward: moneyStringSchema,
  positionPrize: moneyStringSchema,
  payout: moneyStringSchema,
  payoutPaise: z.number(),
  isDeleted: z.boolean(),
}).passthrough();

export const resultPayoutPreviewGuard = z.object({
  entries: z.array(payoutPreviewEntryGuard),
  totalCollected: moneyStringSchema,
  totalCollectedPaise: z.number(),
  totalPayout: moneyStringSchema,
  totalPayoutPaise: z.number(),
  difference: signedMoneyStringSchema,
  differencePaise: z.number(),
  warning: z.string().nullable(),
}).passthrough();

// ─── 5. Deposits & Withdrawals Guards ─────────────────────────────────────────
export const staffDepositDtoGuard = z.object({
  id: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  amount: moneyStringSchema,
  utr: z.string(),
  screenshotUrl: z.string(),
  signedScreenshotUrl: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  rejectReason: z.string().nullable().optional(),
  needsAdmin: z.boolean(),
  pendingMinutes: z.number().nullable().optional(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
}).passthrough();

export const depositListResponseGuard = z.object({
  items: z.array(staffDepositDtoGuard),
  nextCursor: z.string().nullable().optional(),
}).passthrough();

export const staffWithdrawalDtoGuard = z.object({
  id: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  amount: moneyStringSchema,
  upiId: z.string(),
  status: z.enum(['pending', 'paid', 'rejected']),
  rejectReason: z.string().nullable().optional(),
  payoutRef: z.string().nullable().optional(),
  createdAt: z.string(),
  processedAt: z.string().nullable().optional(),
  processedBy: z.string().nullable().optional(),
}).passthrough();

export const withdrawalListResponseGuard = z.object({
  items: z.array(staffWithdrawalDtoGuard),
  nextCursor: z.string().nullable().optional(),
}).passthrough();
