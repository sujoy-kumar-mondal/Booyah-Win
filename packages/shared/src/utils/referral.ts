import crypto from 'crypto';

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, REFERRAL_ALPHABET.length);
    code += REFERRAL_ALPHABET[idx];
  }
  return code;
}

export function isValidReferralCodeFormat(code: string): boolean {
  if (code.length !== 8) return false;
  const upper = code.toUpperCase();
  for (const char of upper) {
    if (!REFERRAL_ALPHABET.includes(char)) return false;
  }
  return true;
}
