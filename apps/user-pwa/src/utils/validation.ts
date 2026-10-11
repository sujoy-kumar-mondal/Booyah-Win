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
