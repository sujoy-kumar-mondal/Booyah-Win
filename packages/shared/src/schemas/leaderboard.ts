import { z } from 'zod';

export const leaderboardEntrySchema = z
  .object({
    rank: z.number().int().positive(),
    name: z.string(),
    winnings: z.string().regex(/^\d+\.\d{2}$/, 'Must be a valid 2-decimal money string'),
  })
  .strict();

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z
  .object({
    weekStart: z.string(),
    weekEnd: z.string(),
    generatedAt: z.string(),
    entries: z.array(leaderboardEntrySchema),
  })
  .strict();

export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

export const leaderboardRankResponseSchema = z
  .object({
    rank: z.number().int().positive(),
    winnings: z.string().regex(/^\d+\.\d{2}$/, 'Must be a valid 2-decimal money string'),
  })
  .strict()
  .nullable();

export type LeaderboardRankResponse = z.infer<typeof leaderboardRankResponseSchema>;
