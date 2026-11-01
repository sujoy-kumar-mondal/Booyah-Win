import { z } from 'zod';

export const statusResponseSchema = z
  .object({
    maintenance: z
      .object({
        enabled: z.boolean(),
        message: z.string().nullable(),
        until: z.string().nullable(),
        unknown: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();

export type StatusResponse = z.infer<typeof statusResponseSchema>;
