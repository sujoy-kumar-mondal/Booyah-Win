import { ErrorCodes, type ErrorCode } from '@booyah/shared';
import { getLanguageCookie } from '../i18n/cookies.js';

/**
 * Friendly User Message Table for all Section 22 Error Codes (English)
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCodes.UNAUTHENTICATED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.SESSION_REPLACED]: 'You were logged out because your account was used on another device.',
  [ErrorCodes.FORBIDDEN]: 'Only team leader can change teammates.',
  [ErrorCodes.ADMIN_APPROVAL_REQUIRED]: 'This transaction requires administrator review.',
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your inputs and try again.',
  [ErrorCodes.INVALID_OTP]: 'Invalid or expired OTP code. Please check the code or request a new one.',
  [ErrorCodes.OTP_RATE_LIMITED]: 'Too many OTP requests. Please wait a few moments before requesting another.',
  [ErrorCodes.EMAIL_EXISTS]: 'This email is already registered. Please log in instead.',
  [ErrorCodes.MOBILE_EXISTS]: 'This mobile number is already linked to another account.',
  [ErrorCodes.FF_ID_EXISTS]: 'This Free Fire ID is already registered to another player.',
  [ErrorCodes.UPI_EXISTS]: 'This UPI ID is already registered to another account.',
  [ErrorCodes.INVALID_REFERRAL]: 'Invalid referral code. Please check the code or leave it blank.',
  [ErrorCodes.FIELD_COOLDOWN]: 'This field was changed recently and cannot be updated yet.',
  [ErrorCodes.IN_ACTIVE_MATCH]: 'You cannot modify profile details while enrolled in an upcoming or live match.',
  [ErrorCodes.LOW_BALANCE]: 'Insufficient wallet balance. Please add money to continue.',
  [ErrorCodes.UTR_EXISTS]: 'This transaction UTR has already been submitted.',
  [ErrorCodes.DEPOSIT_LIMIT]: 'Deposit amount is outside the allowed limits.',
  [ErrorCodes.WITHDRAWAL_PENDING]: 'You already have a pending withdrawal request in progress.',
  [ErrorCodes.UPI_RECENTLY_CHANGED]: 'Withdrawals are locked for 48 hours following a UPI ID change.',
  [ErrorCodes.MATCH_FULL]: 'This match is full. Please browse other available matches.',
  [ErrorCodes.ALREADY_JOINED]: 'You have already joined this match.',
  [ErrorCodes.MATCH_NOT_JOINABLE]: 'This match is no longer accepting new players.',
  [ErrorCodes.TEAM_INVALID]: 'Invalid team configuration or player roster.',
  [ErrorCodes.INVITE_EXPIRED]: 'This team invitation has expired.',
  [ErrorCodes.RESULT_INVALID]: 'The submitted match results are invalid.',
  [ErrorCodes.RESULT_LOCKED]: 'Match results have been approved and locked.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please slow down and try again shortly.',
  [ErrorCodes.INTERNAL_ERROR]: 'An unexpected system error occurred. Please try again.',
  [ErrorCodes.INVALID_TRANSITION]: 'This match action cannot be performed in its current status.',
  [ErrorCodes.DATABASE_BUSY]: 'The server is temporarily busy. Please retry in a few seconds.',
  [ErrorCodes.ADMINS_APPROVE_DIRECTLY]: 'Admins approve directly',
  [ErrorCodes.MAINTENANCE_MODE]: 'The platform is currently undergoing scheduled maintenance. Please try again shortly.',
  [ErrorCodes.REAUTH_REQUIRED]: 'Security verification required. Please verify OTP to proceed.',
};

/**
 * Friendly User Message Table for all Section 22 Error Codes (Bengali / বাংলা)
 */
export const ERROR_MESSAGES_BN: Record<ErrorCode, string> = {
  [ErrorCodes.UNAUTHENTICATED]: 'আপনার সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।',
  [ErrorCodes.SESSION_REPLACED]: 'আপনার অ্যাকাউন্টটি অন্য ডিভাইসে ব্যবহার করায় আপনি লগআউট হয়ে গেছেন।',
  [ErrorCodes.FORBIDDEN]: 'শুধুমাত্র টিম লিডারই সতীর্থ পরিবর্তন করতে পারবেন।',
  [ErrorCodes.ADMIN_APPROVAL_REQUIRED]: 'এই লেনদেনটির জন্য অ্যাডমিনের পর্যালোচনার প্রয়োজন।',
  [ErrorCodes.VALIDATION_ERROR]: 'অনুগ্রহ করে আপনার তথ্য পরীক্ষা করুন এবং পুনরায় চেষ্টা করুন।',
  [ErrorCodes.INVALID_OTP]: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড। অনুগ্রহ করে কোডটি যাচাই করুন বা নতুন OTP চান।',
  [ErrorCodes.OTP_RATE_LIMITED]: 'খুব বেশি OTP চাওয়া হয়েছে। কিছুক্ষণ অপেক্ষা করে পুনরায় চেষ্টা করুন।',
  [ErrorCodes.EMAIL_EXISTS]: 'এই ইমেইলটি ইতিমধ্যেই নিবন্ধিত। অনুগ্রহ করে লগইন করুন।',
  [ErrorCodes.MOBILE_EXISTS]: 'এই মোবাইল নম্বরটি অন্য অ্যাকাউন্টের সাথে যুক্ত।',
  [ErrorCodes.FF_ID_EXISTS]: 'এই Free Fire ID-টি অন্য খেলোয়াড়ের নামে নিবন্ধিত।',
  [ErrorCodes.UPI_EXISTS]: 'এই UPI ID-টি অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।',
  [ErrorCodes.INVALID_REFERRAL]: 'ভুল রেফারেল কোড। কোডটি পরীক্ষা করুন বা ফাঁকা রাখুন।',
  [ErrorCodes.FIELD_COOLDOWN]: 'এই তথ্যটি সম্প্রতি পরিবর্তন করা হয়েছে এবং এখনই পরিবর্তনযোগ্য নয়।',
  [ErrorCodes.IN_ACTIVE_MATCH]: 'আসন্ন বা লাইভ ম্যাচে যুক্ত থাকা অবস্থায় প্রোফাইলের তথ্য পরিবর্তন করা যাবে না।',
  [ErrorCodes.LOW_BALANCE]: 'অপর্যাপ্ত ওয়ালেট ব্যালেন্স। চালিয়ে যেতে টাকা যোগ করুন।',
  [ErrorCodes.UTR_EXISTS]: 'এই লেনদেনের UTR ইতিপূর্বে জমা দেওয়া হয়েছে।',
  [ErrorCodes.DEPOSIT_LIMIT]: 'জমার পরিমাণ নির্ধারিত সীমার বাইরে।',
  [ErrorCodes.WITHDRAWAL_PENDING]: 'আপনার ইতিমধ্যে একটি উত্তোলনের অনুরোধ প্রক্রিয়াধীন রয়েছে।',
  [ErrorCodes.UPI_RECENTLY_CHANGED]: 'UPI ID পরিবর্তনের পর ৪৮ ঘণ্টার জন্য উত্তোলন বন্ধ থাকে।',
  [ErrorCodes.MATCH_FULL]: 'এই ম্যাচটি পরিপূর্ণ। অনুগ্রহ করে অন্যান্য উপলব্ধ ম্যাচ ব্রাউজ করুন।',
  [ErrorCodes.ALREADY_JOINED]: 'আপনি ইতিমধ্যে এই ম্যাচে যোগ দিয়েছেন।',
  [ErrorCodes.MATCH_NOT_JOINABLE]: 'এই ম্যাচটিতে আর নতুন খেলোয়াড় নেওয়া হচ্ছে না।',
  [ErrorCodes.TEAM_INVALID]: 'দলের বিন্যাস বা খেলোয়াড়দের তালিকায় ত্রুটি রয়েছে।',
  [ErrorCodes.INVITE_EXPIRED]: 'দলের এই আমন্ত্রণের মেয়াদ শেষ হয়ে গেছে।',
  [ErrorCodes.RESULT_INVALID]: 'জমা দেওয়া ম্যাচের ফলাফল গ্রহণযোগ্য নয়।',
  [ErrorCodes.RESULT_LOCKED]: 'ম্যাচের ফলাফল অনুমোদিত এবং লক করা হয়েছে।',
  [ErrorCodes.NOT_FOUND]: 'অনুরোধকৃত তথ্য খুঁজে পাওয়া যায়নি।',
  [ErrorCodes.RATE_LIMITED]: 'অতিরিক্ত অনুরোধ করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
  [ErrorCodes.INTERNAL_ERROR]: 'একটি অপ্রত্যাশিত সিস্টেম ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
  [ErrorCodes.INVALID_TRANSITION]: 'ম্যাচটির বর্তমান অবস্থায় এই কাজটি সম্পাদন করা সম্ভব নয়।',
  [ErrorCodes.DATABASE_BUSY]: 'সার্ভার সাময়িকভাবে ব্যস্ত। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।',
  [ErrorCodes.ADMINS_APPROVE_DIRECTLY]: 'অ্যাডমিন সরাসরি অনুমোদন করেন',
  [ErrorCodes.MAINTENANCE_MODE]: 'প্ল্যাটফর্মটিতে নির্ধারিত রক্ষণাবেক্ষণ চলছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
  [ErrorCodes.REAUTH_REQUIRED]: 'নিরাপত্তা যাচাইকরণ প্রয়োজন। চালিয়ে যেতে OTP যাচাই করুন।',
};

export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';
export const DEFAULT_ERROR_MESSAGE_BN = 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

export const PROD_NETWORK_OR_NON_JSON_MESSAGE = "We couldn't reach the server. Please check your connection and try again.";
export const PROD_NETWORK_OR_NON_JSON_MESSAGE_BN = 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';

export const DEV_NETWORK_MESSAGE = 'Cannot reach the server. Check that the API is running.';
export const DEV_NETWORK_MESSAGE_BN = 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। API চালু আছে কিনা পরীক্ষা করুন।';

export const DEV_NON_JSON_MESSAGE = 'The server sent an unexpected response.';
export const DEV_NON_JSON_MESSAGE_BN = 'সার্ভার একটি অপ্রত্যাশিত প্রতিক্রিয়া পাঠিয়েছে।';

export function getUserFriendlyErrorMessage(
  code?: string | null,
  isDev: boolean = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV),
  preferredLang?: 'en' | 'bn'
): string {
  const currentLang =
    preferredLang ||
    getLanguageCookie() ||
    (typeof document !== 'undefined' && document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const isBn = currentLang === 'bn';

  if (!code) return isBn ? DEFAULT_ERROR_MESSAGE_BN : DEFAULT_ERROR_MESSAGE;

  if (code === 'UNEXPECTED_RESPONSE') {
    return isBn ? 'অপ্রত্যাশিত প্রতিক্রিয়া এসেছে, অনুগ্রহ করে রিফ্রেশ করুন' : 'unexpected response, please refresh';
  }

  if (code === 'NETWORK_ERROR') {
    if (isDev) return isBn ? DEV_NETWORK_MESSAGE_BN : DEV_NETWORK_MESSAGE;
    return isBn ? PROD_NETWORK_OR_NON_JSON_MESSAGE_BN : PROD_NETWORK_OR_NON_JSON_MESSAGE;
  }

  if (code === 'NON_JSON_RESPONSE' || code === 'SERVER_UNAVAILABLE') {
    if (isDev) return isBn ? DEV_NON_JSON_MESSAGE_BN : DEV_NON_JSON_MESSAGE;
    return isBn ? PROD_NETWORK_OR_NON_JSON_MESSAGE_BN : PROD_NETWORK_OR_NON_JSON_MESSAGE;
  }

  const table = isBn ? ERROR_MESSAGES_BN : ERROR_MESSAGES;
  const mapped = table[code as ErrorCode];
  return mapped || (isBn ? DEFAULT_ERROR_MESSAGE_BN : DEFAULT_ERROR_MESSAGE);
}
