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
export interface UserMeDto {
    profile: UserDto;
    wallets: WalletSummaryDto;
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
