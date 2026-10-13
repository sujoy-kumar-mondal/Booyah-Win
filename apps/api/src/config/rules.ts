/**
 * Game and economy operational rules & limits.
 * Single source of truth for reward amounts, caps, and withdrawal thresholds.
 *
 * Money values in integer paise:
 * - REFERRAL_REWARD_PAISE: 500 (₹5.00 credited to cashback on first deposit or match)
 * - CASHBACK_ENTRY_FEE_CAP_PERCENT: 5 (max 5% of entry fee paid from cashback wallet)
 * - MIN_WITHDRAWAL_PAISE: 5000 (₹50.00 minimum withdrawal amount)
 */

export const RULES = {
  REFERRAL_REWARD_PAISE: 500, // ₹5.00
  CASHBACK_ENTRY_FEE_CAP_PERCENT: 5, // 5%
  MIN_WITHDRAWAL_PAISE: 5000, // ₹50.00
} as const;
