import { apiClient } from './client.js';
import {
  runGuard,
  loginVerifyResponseGuard,
  registerVerifyResponseGuard,
  registerCompleteResponseGuard,
} from './guards.js';
import type {
  LoginVerifyResponse,
  RegisterVerifyResponse,
  RegisterCompleteResponse,
  RegisterCompletePayload,
} from './types.js';

export async function requestLoginOtp(email: string): Promise<{ message: string; registered?: boolean }> {
  return apiClient<{ message: string; registered?: boolean }>('/api/v1/auth/login/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyLoginOtp(email: string, otp: string): Promise<LoginVerifyResponse> {
  const data = await apiClient<LoginVerifyResponse>('/api/v1/auth/login/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
  return runGuard(loginVerifyResponseGuard, data, 'POST /api/v1/auth/login/verify-otp');
}

export async function requestRegisterOtp(email: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/auth/register/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyRegisterOtp(email: string, otp: string): Promise<RegisterVerifyResponse> {
  const data = await apiClient<RegisterVerifyResponse>('/api/v1/auth/register/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
  return runGuard(registerVerifyResponseGuard, data, 'POST /api/v1/auth/register/verify-otp');
}

export async function completeRegistration(payload: RegisterCompletePayload): Promise<RegisterCompleteResponse> {
  const data = await apiClient<RegisterCompleteResponse>('/api/v1/auth/register/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return runGuard(registerCompleteResponseGuard, data, 'POST /api/v1/auth/register/complete');
}

export async function logout(): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/auth/logout', {
    method: 'POST',
  });
}
