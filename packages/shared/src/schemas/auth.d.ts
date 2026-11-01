import { z } from 'zod';
export declare const emailSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const otpSchema: z.ZodString;
export declare const nameSchema: z.ZodString;
export declare const mobileSchema: z.ZodString;
export declare const ffIdSchema: z.ZodString;
export declare const ffNameSchema: z.ZodString;
export declare const upiIdSchema: z.ZodString;
export declare function is18Plus(dobStr: string): boolean;
export declare const dateOfBirthSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const referralCodeSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const requestOtpSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
}, "strict", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const verifyOtpSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    otp: z.ZodString;
}, "strict", z.ZodTypeAny, {
    email: string;
    otp: string;
}, {
    email: string;
    otp: string;
}>;
export declare const completeRegistrationSchema: z.ZodObject<{
    registrationToken: z.ZodString;
    name: z.ZodString;
    mobile: z.ZodString;
    ffId: z.ZodString;
    ffName: z.ZodString;
    upiId: z.ZodString;
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    confirm18Plus: z.ZodLiteral<true>;
    referralCode: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    registrationToken: string;
    name: string;
    mobile: string;
    ffId: string;
    ffName: string;
    upiId: string;
    dateOfBirth: string;
    confirm18Plus: true;
    referralCode?: string | undefined;
}, {
    registrationToken: string;
    name: string;
    mobile: string;
    ffId: string;
    ffName: string;
    upiId: string;
    dateOfBirth: string;
    confirm18Plus: true;
    referralCode?: string | undefined;
}>;
