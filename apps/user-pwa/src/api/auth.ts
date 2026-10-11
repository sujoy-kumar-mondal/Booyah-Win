import { apiClient } from './client.js';
import type {
  LoginVerifyResponse,
  RegisterVerifyResponse,
  RegisterCompleteResponse,
  RegisterCompletePayload,
} from './types.js';

export async function requestLoginOtp(email: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/auth/login/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyLoginOtp(email: string, otp: string): Promise<LoginVerifyResponse> {
  return apiClient<LoginVerifyResponse>('/api/v1/auth/login/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function requestRegisterOtp(email: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/auth/register/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyRegisterOtp(email: string, otp: string): Promise<RegisterVerifyResponse> {
  return apiClient<RegisterVerifyResponse>('/api/v1/auth/register/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function completeRegistration(payload: RegisterCompletePayload): Promise<RegisterCompleteResponse> {
  return apiClient<RegisterCompleteResponse>('/api/v1/auth/register/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/auth/logout', {
    method: 'POST',
  });
}
