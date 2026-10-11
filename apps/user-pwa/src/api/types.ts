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
  referredBy: string | null;
  createdAt: string;
}

export interface Wallets {
  addMoney: string;
  cashback: string;
  winning: string;
  total: string;
}

export interface Cooldowns {
  mobileAvailableAt: string | null;
  ffIdAvailableAt: string | null;
  ffNameAvailableAt: string | null;
  upiIdAvailableAt: string | null;
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
