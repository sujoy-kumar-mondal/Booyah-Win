import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(254, 'Email must be at most 254 characters')
  .transform((val) => val.toLowerCase());

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(60, 'Name must be at most 60 characters')
  .regex(/^[a-zA-Z. ]+$/, 'Name must contain only letters, spaces, and dots');

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Mobile must be a valid 10-digit Indian mobile number');

export const ffIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6,15}$/, 'Free Fire ID must be between 6 and 15 digits');

export const ffNameSchema = z
  .string()
  .trim()
  .min(1, 'Free Fire Name is required')
  .max(30, 'Free Fire Name must be at most 30 characters');

export const upiIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID format');

export function is18Plus(dobStr: string): boolean {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 18;
}

export const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
  .refine((val) => is18Plus(val), {
    message: 'Must be at least 18 years old today',
  });

export const referralCodeSchema = z
  .string()
  .trim()
  .length(8, 'Referral code must be 8 characters')
  .transform((val) => val.toUpperCase());

// Request OTP Schema
export const requestOtpSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

// Verify OTP Schema
export const verifyOtpSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
    remember: z.boolean().optional(),
  })
  .strict();

// Step-Up Verify OTP Schema
export const stepUpVerifyOtpSchema = z
  .object({
    otp: otpSchema,
    email: emailSchema.optional(),
  })
  .strict();

// Complete Registration Schema
export const completeRegistrationSchema = z
  .object({
    registrationToken: z.string().trim().min(1, 'Registration token required'),
    name: nameSchema,
    mobile: mobileSchema,
    ffId: ffIdSchema,
    ffName: ffNameSchema,
    upiId: upiIdSchema,
    dateOfBirth: dateOfBirthSchema,
    confirm18Plus: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm you are 18 or older' }),
    }),
    referralCode: referralCodeSchema.optional(),
    language: z.enum(['en', 'bn']).optional(),
  })
  .strict();

// Update Language Schema
export const updateLanguageSchema = z
  .object({
    language: z.enum(['en', 'bn'], {
      required_error: 'Language is required',
      invalid_type_error: "Language must be 'en' or 'bn'",
    }),
  })
  .strict();

// Update Profile Schema (only mobile, ffId, ffName, upiId are editable; any other field rejected)
export const updateProfileSchema = z
  .object({
    mobile: mobileSchema.optional(),
    ffId: ffIdSchema.optional(),
    ffName: ffNameSchema.optional(),
    upiId: upiIdSchema.optional(),
  })
  .strict();
