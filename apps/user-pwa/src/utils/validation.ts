/**
 * Client-side validation helpers matching Section 4.5 of BOOYAH_WIN_SPEC.md
 * Note: Client validation provides user convenience; server validation is authoritative.
 */

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  if (trimmed.length > 254) return 'Email must not exceed 254 characters';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return 'Enter a valid email address';
  return null;
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Full name is required';
  if (trimmed.length < 2 || trimmed.length > 60) {
    return 'Name must be between 2 and 60 characters';
  }
  const nameRegex = /^[A-Za-z. ]+$/;
  if (!nameRegex.test(trimmed)) {
    return 'Name can only contain letters, spaces, and dots';
  }
  return null;
}

export function validateMobile(mobile: string): string | null {
  const trimmed = mobile.trim();
  if (!trimmed) return 'Mobile number is required';
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(trimmed)) {
    return 'Enter a valid 10-digit Indian mobile number';
  }
  return null;
}

export function validateFfId(ffId: string): string | null {
  const trimmed = ffId.trim();
  if (!trimmed) return 'Free Fire ID is required';
  const ffIdRegex = /^\d{6,15}$/;
  if (!ffIdRegex.test(trimmed)) {
    return 'Free Fire ID must be between 6 and 15 digits';
  }
  return null;
}

export function validateFfName(ffName: string): string | null {
  const trimmed = ffName.trim();
  if (!trimmed) return 'Free Fire In-Game Name is required';
  if (trimmed.length < 1 || trimmed.length > 30) {
    return 'Free Fire Name must be between 1 and 30 characters';
  }
  return null;
}

export function validateUpiId(upiId: string): string | null {
  const trimmed = upiId.trim();
  if (!trimmed) return 'UPI ID is required';
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  if (!upiRegex.test(trimmed)) {
    return 'Enter a valid UPI ID (e.g. player@upi)';
  }
  return null;
}

export function validateDateOfBirth(dobStr: string): string | null {
  const trimmed = dobStr.trim();
  if (!trimmed) return 'Date of birth is required';
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return 'Invalid date format';

  const today = new Date();
  const eighteenYearsAgo = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );

  if (date > eighteenYearsAgo) {
    return 'You must be at least 18 years old to participate';
  }
  return null;
}

export function validateReferralCode(code?: string): string | null {
  if (!code || !code.trim()) return null; // optional
  const trimmed = code.trim();
  if (trimmed.length < 4 || trimmed.length > 20) {
    return 'Referral code must be between 4 and 20 characters';
  }
  return null;
}

/**
 * Validates a deposit amount string against API limits.
 * Requirement 6: Deposit min and max come only from the API; no hardcoded limits.
 */
export function validateDepositAmount(
  amountStr: string,
  minStr?: string | null,
  maxStr?: string | null
): string | null {
  const trimmed = amountStr.trim();
  if (!trimmed) return 'Amount is required';

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return 'Enter a valid amount with at most 2 decimal places';
  }

  let paise: number;
  try {
    paise = parsePaiseSafe(trimmed);
  } catch {
    return 'Invalid amount';
  }

  if (paise <= 0) {
    return 'Amount must be greater than zero';
  }

  if (minStr) {
    try {
      const minPaise = parsePaiseSafe(minStr);
      if (paise < minPaise) {
        return `Minimum deposit is Rs${minStr}`;
      }
    } catch {
      // ignore
    }
  }

  if (maxStr) {
    try {
      const maxPaise = parsePaiseSafe(maxStr);
      if (paise > maxPaise) {
        return `Maximum deposit is Rs${maxStr}`;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Validates a withdrawal amount string against minimum 50 and current winning balance.
 */
export function validateWithdrawAmount(
  amountStr: string,
  winningBalanceStr?: string | null
): string | null {
  const trimmed = amountStr.trim();
  if (!trimmed) return 'Amount is required';

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return 'Enter a valid amount with at most 2 decimal places';
  }

  let paise: number;
  try {
    paise = parsePaiseSafe(trimmed);
  } catch {
    return 'Invalid amount';
  }

  if (paise < 5000) {
    return 'Minimum withdrawal is Rs50.00';
  }

  if (winningBalanceStr) {
    try {
      const winningPaise = parsePaiseSafe(winningBalanceStr);
      if (paise > winningPaise) {
        return 'Withdrawal amount cannot exceed your Winning balance';
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Validates UTR / Transaction ID (Section 4.5: 10-25 alphanumeric).
 */
export function validateUtr(utr: string): string | null {
  const trimmed = utr.trim();
  if (!trimmed) return 'UTR / transaction ID is required';
  if (!/^[A-Za-z0-9]{10,25}$/.test(trimmed)) {
    return 'UTR must be 10-25 alphanumeric characters';
  }
  return null;
}

/**
 * Validates screenshot file (JPEG, PNG, WebP; max 2 MB).
 */
export function validateScreenshot(file: File | null): string | null {
  if (!file) return 'Payment screenshot is required';
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return 'Only JPEG, PNG, or WebP images are allowed';
  }
  const maxBytes = 2 * 1024 * 1024; // 2 MB
  if (file.size > maxBytes) {
    return 'Screenshot size must not exceed 2 MB';
  }
  return null;
}

/**
 * Helper to safely parse integer paise from a 2-decimal money string without floats.
 */
export function parsePaiseSafe(val: string): number {
  const trimmed = val.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Invalid money string');
  }
  const isNeg = trimmed.startsWith('-');
  const clean = isNeg ? trimmed.slice(1) : trimmed;
  const [intPart, decPart = ''] = clean.split('.');
  const decPadded = (decPart + '00').slice(0, 2);
  const paise = BigInt(intPart || '0') * 100n + BigInt(decPadded);
  const signed = isNeg ? -paise : paise;
  return Number(signed);
}

