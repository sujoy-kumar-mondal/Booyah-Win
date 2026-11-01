"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeRegistrationSchema = exports.verifyOtpSchema = exports.requestOtpSchema = exports.referralCodeSchema = exports.dateOfBirthSchema = exports.upiIdSchema = exports.ffNameSchema = exports.ffIdSchema = exports.mobileSchema = exports.nameSchema = exports.otpSchema = exports.emailSchema = void 0;
exports.is18Plus = is18Plus;
const zod_1 = require("zod");
exports.emailSchema = zod_1.z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email must be at most 254 characters')
    .transform((val) => val.toLowerCase());
exports.otpSchema = zod_1.z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');
exports.nameSchema = zod_1.z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be at most 60 characters')
    .regex(/^[a-zA-Z. ]+$/, 'Name must contain only letters, spaces, and dots');
exports.mobileSchema = zod_1.z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Mobile must be a valid 10-digit Indian mobile number');
exports.ffIdSchema = zod_1.z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, 'Free Fire ID must be between 6 and 15 digits');
exports.ffNameSchema = zod_1.z
    .string()
    .trim()
    .min(1, 'Free Fire Name is required')
    .max(30, 'Free Fire Name must be at most 30 characters');
exports.upiIdSchema = zod_1.z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID format');
function is18Plus(dobStr) {
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime()))
        return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age >= 18;
}
exports.dateOfBirthSchema = zod_1.z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine((val) => is18Plus(val), {
    message: 'Must be at least 18 years old today',
});
exports.referralCodeSchema = zod_1.z
    .string()
    .trim()
    .length(8, 'Referral code must be 8 characters')
    .transform((val) => val.toUpperCase());
// Request OTP Schema
exports.requestOtpSchema = zod_1.z
    .object({
    email: exports.emailSchema,
})
    .strict();
// Verify OTP Schema
exports.verifyOtpSchema = zod_1.z
    .object({
    email: exports.emailSchema,
    otp: exports.otpSchema,
})
    .strict();
// Complete Registration Schema
exports.completeRegistrationSchema = zod_1.z
    .object({
    registrationToken: zod_1.z.string().trim().min(1, 'Registration token required'),
    name: exports.nameSchema,
    mobile: exports.mobileSchema,
    ffId: exports.ffIdSchema,
    ffName: exports.ffNameSchema,
    upiId: exports.upiIdSchema,
    dateOfBirth: exports.dateOfBirthSchema,
    confirm18Plus: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'You must confirm you are 18 or older' }),
    }),
    referralCode: exports.referralCodeSchema.optional(),
})
    .strict();
//# sourceMappingURL=auth.js.map