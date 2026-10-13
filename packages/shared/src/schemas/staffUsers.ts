import { z } from 'zod';

export const staffUserListItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    mobile: z.string(),
    ffId: z.string(),
    ffName: z.string(),
    upiId: z.string(),
    isDeleted: z.boolean(),
    deletedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export type StaffUserListItem = z.infer<typeof staffUserListItemSchema>;

export const staffUserListResponseSchema = z
  .object({
    items: z.array(staffUserListItemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .strict();

export type StaffUserListResponse = z.infer<typeof staffUserListResponseSchema>;

export const staffUserLedgerItemSchema = z
  .object({
    id: z.number(),
    wallet: z.string(),
    type: z.string(),
    amount: z.string(),
    balanceAfter: z.string(),
    totalAfter: z.string(),
    refType: z.string().nullable(),
    refId: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export const staffUserMatchHistoryItemSchema = z
  .object({
    matchId: z.string(),
    gameMode: z.string(),
    teamMode: z.string(),
    entryFee: z.string(),
    startTime: z.string(),
    matchStatus: z.string(),
    kills: z.number(),
    position: z.number().nullable(),
    payout: z.string(),
    displayStatus: z.string(),
    joinedAt: z.string(),
  })
  .strict();

export const staffUserDepositItemSchema = z
  .object({
    id: z.string(),
    amount: z.string(),
    utr: z.string(),
    status: z.enum(['pending', 'employee_approved', 'approved', 'rejected']),
    rejectReason: z.string().nullable(),
    createdAt: z.string(),
    reviewedAt: z.string().nullable(),
    employeeReviewedAt: z.string().nullable(),
  })
  .strict();

export const staffUserWithdrawalItemSchema = z
  .object({
    id: z.string(),
    amount: z.string(),
    upiId: z.string(),
    status: z.enum(['pending', 'employee_approved', 'paid', 'rejected']),
    rejectReason: z.string().nullable(),
    payoutRef: z.string().nullable(),
    createdAt: z.string(),
    processedAt: z.string().nullable(),
    employeeReviewedAt: z.string().nullable(),
  })
  .strict();

export const staffUserDetailResponseSchema = z
  .object({
    profile: staffUserListItemSchema,
    wallets: z
      .object({
        addMoney: z.string(),
        cashback: z.string(),
        winning: z.string(),
        total: z.string(),
      })
      .strict(),
    recentLedger: z.array(staffUserLedgerItemSchema),
    matchHistory: z.array(staffUserMatchHistoryItemSchema),
    depositHistory: z.array(staffUserDepositItemSchema),
    withdrawalHistory: z.array(staffUserWithdrawalItemSchema),
  })
  .strict();

export type StaffUserDetailResponse = z.infer<typeof staffUserDetailResponseSchema>;
