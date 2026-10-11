/**
 * API Data Models matching docs/API.md exactly
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
  dateOfBirth: string;
  referralCode: string;
  referredBy?: string | null;
  createdAt: string;
}

export interface Wallets {
  addMoney: string;
  cashback: string;
  winning: string;
  total: string;
}

export interface Cooldowns {
  mobileAvailableAt?: string | null;
  ffIdAvailableAt?: string | null;
  ffNameAvailableAt?: string | null;
  upiIdAvailableAt?: string | null;
}

export interface GetMeData {
  profile: UserProfile;
  wallets: Wallets;
  cooldowns: Cooldowns;
}

export interface LoginVerifyResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    mobile: string;
    ffId: string;
    ffName: string;
    upiId: string;
    referralCode: string;
    dateOfBirth: string;
  };
}

export interface RegisterVerifyResponse {
  registrationToken: string;
}

export interface RegisterCompleteResponse {
  token: string;
  user: UserProfile;
}

export interface RegisterCompletePayload {
  registrationToken: string;
  name: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
  dateOfBirth: string;
  confirm18Plus: boolean;
  referralCode?: string;
}

export interface UpdateProfilePayload {
  mobile?: string;
  ffId?: string;
  ffName?: string;
  upiId?: string;
}

export interface PaymentInfoDto {
  configured: boolean;
  message?: string;
  paymentUpiId?: string | null;
  paymentQrUrl?: string | null;
  qrUrl?: string | null;
  minDeposit: string;
  maxDeposit: string;
}

export interface DepositDto {
  id: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string | null;
  needsAdmin: boolean;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface DepositListResponse {
  items: DepositDto[];
  nextCursor?: string | null;
}

export interface WithdrawalDto {
  id: string;
  amount: string;
  upiId: string;
  status: 'pending' | 'paid' | 'rejected';
  rejectReason?: string | null;
  payoutRef?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

export interface WithdrawalListResponse {
  items: WithdrawalDto[];
  nextCursor?: string | null;
}

export interface TransactionDto {
  transactionId: string;
  type: string;
  createdAt: string;
  amount: string;
  remainingAmount: string;
  wallet: string;
  refType?: string | null;
  refId?: string | null;
}

export interface TransactionListResponse {
  items: TransactionDto[];
  nextCursor?: string | null;
}
