import { z } from 'zod';
import { emailSchema, mobileSchema, nameSchema } from './auth.js';

export const panSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format (e.g. ABCDE1234F)');

export const aadhaarSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, 'Invalid Aadhaar format (must be 12 digits)');

export const createEmployeeSchema = z
  .object({
    name: nameSchema,
    mobile: mobileSchema,
    email: emailSchema,
    pan: panSchema.optional().or(z.literal('')),
    aadhaar: aadhaarSchema.optional().or(z.literal('')),
    role: z
      .any()
      .refine((val) => val === undefined, {
        message: 'Admin cannot specify a role (all created accounts are employees)',
      })
      .optional(),
  })
  .strict();

export const updateEmployeeSchema = z
  .object({
    name: nameSchema.optional(),
    mobile: mobileSchema.optional(),
    email: emailSchema.optional(),
    pan: panSchema.optional().or(z.literal('')),
    aadhaar: aadhaarSchema.optional().or(z.literal('')),
    role: z
      .any()
      .refine((val) => val === undefined, {
        message: 'Role cannot be modified',
      })
      .optional(),
  })
  .strict()
  .refine(
    (data) => !('role' in data),
    {
      message: 'Role cannot be modified',
      path: ['role'],
    }
  );

export const updateSettingsSchema = z
  .object({
    min_deposit: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid money format')
      .optional(),
    max_deposit: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid money format')
      .optional(),
    admin_approval_threshold: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid money format')
      .optional(),
    support_name: z.string().trim().max(60).optional(),
    support_phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Must be a 10-digit Indian mobile number')
      .optional()
      .or(z.literal('')),
    support_email: emailSchema.optional().or(z.literal('')),
    support_hours: z.string().trim().max(100).optional(),
    payment_upi_id: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID format')
      .optional()
      .or(z.literal('')),
    // Rule #7: payment_qr_url: https URLs only
    payment_qr_url: z
      .string()
      .trim()
      .regex(/^https:\/\/.+/, 'Payment QR URL must be a valid HTTPS URL')
      .optional()
      .or(z.literal('')),
    maintenance_enabled: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((val) => (typeof val === 'boolean' ? (val ? 'true' : 'false') : val))
      .optional(),
    maintenance_message: z
      .string()
      .trim()
      .max(300, 'Maintenance message must be at most 300 characters')
      .regex(/^[^\x00-\x1F\x7F]*$/, 'Maintenance message cannot contain control characters')
      .optional()
      .or(z.literal('')),
    maintenance_until: z
      .string()
      .trim()
      .regex(/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(\+05:30|Z|[+-]\d{2}:\d{2})$/, 'Invalid ISO datetime format')
      .optional()
      .or(z.literal(''))
      .nullable(),
  })
  .strict();

export const tierPositionSchema = z
  .object({
    position: z.number().int().min(1, 'Position must be >= 1'),
    prize: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Invalid prize format'),
  })
  .strict();

export const createTierSchema = z
  .object({
    gameMode: z.enum(['battle_royale', 'clash_squad']),
    teamMode: z.enum(['solo', 'duo', 'squad']),
    entryFee: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Invalid entry fee'),
    killPrice: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid kill price')
      .optional()
      .default('0.00'),
    minKillsForReward: z.number().int().min(0).optional().default(2),
    maxPlayers: z.number().int().min(2).optional(),
    minPlayers: z.number().int().min(2).optional(),
    positions: z
      .array(tierPositionSchema)
      .min(1, 'At least position 1 prize must be defined'),
  })
  .strict();

export const updateTierSchema = createTierSchema.partial();

export const adminAdjustmentSchema = z
  .object({
    wallet: z.enum(['add_money', 'cashback', 'winning']),
    amount: z
      .string()
      .trim()
      .regex(/^-?\d+(\.\d{1,2})?$/, 'Invalid money format (e.g. 50.00 or -50.00)'),
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters'),
  })
  .strict();
