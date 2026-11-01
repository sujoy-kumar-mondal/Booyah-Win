export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface UserDto {
  id: string;
  username: string;
  email: string;
  name: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
  dateOfBirth: string;
  referralCode: string;
  referredBy?: string | null;
  avatarUrl?: string | null;
  language?: 'en' | 'bn';
  createdAt: string;
}

export interface StaffDto {
  id: string;
  role: 'admin' | 'employee';
  name: string;
  email: string;
  mobile: string;
  createdAt: string;
}

export interface WalletSummaryDto {
  addMoney: string;
  cashback: string;
  winning: string;
  total: string;
}

export interface UserCooldownsDto {
  nameAvailableAt?: string | null;
  mobileAvailableAt: string | null;
  ffIdAvailableAt: string | null;
  ffNameAvailableAt: string | null;
  upiIdAvailableAt: string | null;
}

export interface UserMeDto {
  profile: UserDto;
  wallets: WalletSummaryDto;
  cooldowns?: UserCooldownsDto;
}

export interface StaffMeDto {
  profile: StaffDto;
}

export interface AuthSessionTokenDto {
  token: string;
  user?: UserDto;
  staff?: StaffDto;
}

export interface RegistrationTokenPayload {
  email: string;
  otpId: string;
  purpose: 'register';
}

export interface SessionJwtPayload {
  sub: string;
  typ: 'user' | 'staff';
  sid: string;
  role: string;
}

export interface BannerDto {
  id: string;
  title: string | null;
  imageUrl: string;
  imageKey?: string;
  targetUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePointDto {
  label: string;
  text: string;
}

export interface ImportantUpdateDto {
  id: string;
  title: string;
  category: string;
  dateDisplay: string;
  heading: string;
  summary?: string | null;
  points: UpdatePointDto[];
  notice?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'room_open'
  | 'room_live'
  | 'match_joined'
  | 'wallet_deposit'
  | 'wallet_withdrawal'
  | 'reward'
  | 'match_cancelled'
  | 'announcement'
  | 'tournament'
  | 'room_credential'
  | 'alert';

export interface NotificationItemDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  createdAt: number;
  roomId?: string;
  roomPassword?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export const ALLOWED_MAPS = [
  'Bermuda',
  'Bermuda Remastered',
  'Purgatory',
  'Kalahari',
  'Alpine',
  'NeXTerra',
  'Solara',
  'Iron Cage',
  'El Pastelo',
  'Stone Ridge',
  'Cage',
  'Santa Catarina',
] as const;

export type MapName = typeof ALLOWED_MAPS[number];



