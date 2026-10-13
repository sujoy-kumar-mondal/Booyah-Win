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
  status: z.enum(['pending', 'employee_approved', 'approved', 'rejected']),
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
  status: z.enum(['pending', 'employee_approved', 'paid', 'rejected']),
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

// ─── 3. Match Schemas ────────────────────────────────────────────────────────
export const matchUserDtoGuard = z.object({
  id: z.string(),
  gameMode: z.string(),
  teamMode: z.string(),
  entryFee: moneyStringSchema,
  prizes: z.object({
    positions: z.record(z.string(), moneyStringSchema),
    killPrice: moneyStringSchema,
    minKillsForReward: z.number(),
  }),
  joinedPlayers: z.number(),
  seatsTaken: z.number(),
  maxPlayers: z.number(),
  minPlayers: z.number(),
  startTime: z.string(),
  status: z.string(),
  hasJoined: z.boolean(),
  isInTeam: z.boolean(),
  roomId: z.string().optional(),
  roomPassword: z.string().optional(),
}).passthrough();

export const userMatchListResponseGuard = z.object({
  matches: z.array(matchUserDtoGuard),
}).passthrough();

export const userMatchDetailResponseGuard = z.object({
  match: matchUserDtoGuard,
}).passthrough();

export const userMatchJoinResponseGuard = z.object({
  message: z.string(),
  matchId: z.string(),
  joinedAt: z.string(),
}).passthrough();

// ─── 4. Team & Invites Schemas ───────────────────────────────────────────────
export const teamMemberDtoGuard = z.object({
  userId: z.string(),
  freeFireId: z.string(),
  name: z.string(),
  role: z.enum(['leader', 'member']),
  status: z.enum(['confirmed', 'pending', 'declined', 'expired']),
}).passthrough();

export const teamDtoGuard = z.object({
  id: z.string(),
  matchId: z.string(),
  leaderId: z.string(),
  name: z.string().nullable(),
  size: z.number(),
  status: z.enum(['forming', 'confirmed', 'disbanded']),
  createdAt: z.string(),
  members: z.array(teamMemberDtoGuard),
}).passthrough();

export const userTeamCreateResponseGuard = z.object({
  team: teamDtoGuard,
}).passthrough();

export const userTeamReplaceResponseGuard = z.object({
  message: z.string(),
}).passthrough();

export const userTeamDisbandResponseGuard = z.object({
  message: z.string(),
}).passthrough();

export const teamInviteDtoGuard = z.object({
  id: z.string(),
  teamId: z.string(),
  teamName: z.string().nullable(),
  teamSize: z.number(),
  leaderId: z.string(),
  leaderName: z.string().optional(),
  leaderFfId: z.string().optional(),
  matchId: z.string(),
  gameMode: z.string().optional(),
  teamMode: z.string().optional(),
  entryFee: moneyStringSchema.optional(),
  startTime: z.string().optional(),
  matchStatus: z.string().optional(),
  invitedUserId: z.string(),
  status: z.enum(['pending', 'accepted', 'declined', 'expired']),
  createdAt: z.string(),
  respondedAt: z.string().nullable(),
}).passthrough();

export const userTeamInvitesResponseGuard = z.object({
  invites: z.array(teamInviteDtoGuard),
}).passthrough();

export const userInviteActionResponseGuard = z.object({
  message: z.string(),
}).passthrough();

// ─── 5. Match History Schemas ─────────────────────────────────────────────────
export const userMatchHistoryItemGuard = z.object({
  matchId: z.string(),
  gameMode: z.string(),
  teamMode: z.string(),
  entryFee: moneyStringSchema,
  startTime: z.string(),
  matchStatus: z.string(),
  joinedAt: z.string(),
  refundedAt: z.string().nullable(),
  kills: z.number(),
  position: z.number().nullable(),
  payout: moneyStringSchema,
  displayStatus: z.string(),
  positionLabel: z.string(),
}).passthrough();

export const userMatchHistoryResponseGuard = z.object({
  items: z.array(userMatchHistoryItemGuard),
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean(),
}).passthrough();

// ─── 6. Support Schemas ───────────────────────────────────────────────────────
export const userSupportInfoResponseGuard = z.object({
  supportName: z.string(),
  supportPhone: z.string(),
  supportEmail: z.string(),
  supportHours: z.string(),
}).passthrough();

// ─── 7. Error Envelope Schema ─────────────────────────────────────────────────
export const apiErrorEnvelopeGuard = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
}).passthrough();

// ─── 8. Status & Maintenance Schema ───────────────────────────────────────────
export const statusResponseGuard = z.object({
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string(),
    until: z.string().nullable(),
    unknown: z.boolean().optional(),
  }).passthrough(),
}).passthrough();

// ─── 9. Leaderboard Schemas ───────────────────────────────────────────────────
export const leaderboardEntryGuard = z.object({
  rank: z.number().int().positive(),
  name: z.string(),
  winnings: moneyStringSchema,
}).passthrough();

export const leaderboardResponseGuard = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  generatedAt: z.string(),
  entries: z.array(leaderboardEntryGuard),
}).passthrough();

export const leaderboardRankResponseGuard = z.object({
  rank: z.number().int().positive(),
  winnings: moneyStringSchema,
}).passthrough().nullable();

// ─── 10. Rules & Referral Schemas ─────────────────────────────────────────────
export const rulesResponseGuard = z.object({
  referralReward: moneyStringSchema,
  maxCashbackUsagePercent: z.number().int().positive(),
  minWithdrawal: moneyStringSchema,
}).passthrough();

export const referralSummaryResponseGuard = z.object({
  referralCode: z.string(),
  referredCount: z.number().int().nonnegative(),
  bonusEarnedCount: z.number().int().nonnegative(),
  totalBonusEarned: moneyStringSchema,
}).passthrough();


