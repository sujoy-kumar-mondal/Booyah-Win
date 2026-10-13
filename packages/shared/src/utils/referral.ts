const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(): string {
  let code = '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      const idx = bytes[i] % REFERRAL_ALPHABET.length;
      code += REFERRAL_ALPHABET[idx];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor(Math.random() * REFERRAL_ALPHABET.length);
      code += REFERRAL_ALPHABET[idx];
    }
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
