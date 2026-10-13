import { z } from 'zod';

export const rulesResponseSchema = z
  .object({
    referralReward: z.string().regex(/^\d+\.\d{2}$/, 'Must be a valid 2-decimal money string'),
    maxCashbackUsagePercent: z.number().int().positive(),
    minWithdrawal: z.string().regex(/^\d+\.\d{2}$/, 'Must be a valid 2-decimal money string'),
  })
  .strict();

export type RulesResponse = z.infer<typeof rulesResponseSchema>;
