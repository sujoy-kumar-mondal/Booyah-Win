import { z } from 'zod';

export const referralSummaryResponseSchema = z
  .object({
    referralCode: z.string(),
    referredCount: z.number().int().nonnegative(),
    bonusEarnedCount: z.number().int().nonnegative(),
    totalBonusEarned: z.string().regex(/^\d+\.\d{2}$/, 'Must be a valid 2-decimal money string'),
  })
  .strict();

export type ReferralSummaryResponse = z.infer<typeof referralSummaryResponseSchema>;
