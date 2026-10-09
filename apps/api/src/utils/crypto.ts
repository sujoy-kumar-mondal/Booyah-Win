import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { RegistrationTokenPayload, SessionJwtPayload } from '@booyah/shared';
import { config } from '../config/index.js';

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', config.OTP_HMAC_SECRET).update(otp).digest('hex');
}

export function signSessionToken(payload: SessionJwtPayload, expiresIn: string | number): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifySessionToken(token: string): SessionJwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as SessionJwtPayload;
}

export function signRegistrationToken(payload: RegistrationTokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '15m' as any });
}

export function verifyRegistrationToken(token: string): RegistrationTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as RegistrationTokenPayload;
}
