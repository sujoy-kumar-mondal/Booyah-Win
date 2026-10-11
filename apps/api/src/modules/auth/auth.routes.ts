import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { config } from '../../config/index.js';
import { authenticateStaff, authenticateUser, requireStaff } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { AuthController } from './auth.controller.js';

// IP rate limit: 20 OTP requests per hour per IP (Section 5.1)
export const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const isEnabled = req.app?.get('enableRateLimiting');
    if (isEnabled !== undefined) return !isEnabled;
    return config.NODE_ENV === 'test';
  },
  handler: () => {
    throw new AppError(
      ErrorCodes.OTP_RATE_LIMITED,
      'Too many OTP requests from this IP. Please try again after an hour.',
      429
    );
  },
});

// IP rate limit: 10 registration completions per minute per IP (SEC-02)
export const registerCompleteIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `register_complete:${req.ip}`,
  skip: (req) => {
    const isEnabled = req.app?.get('enableRateLimiting');
    if (isEnabled !== undefined) return !isEnabled;
    return config.NODE_ENV === 'test';
  },
  handler: () => {
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      'Too many registration completion requests from this IP. Please try again after a minute.',
      429
    );
  },
});

export const authRouter = Router();

// User registration routes
authRouter.post('/register/request-otp', otpIpLimiter, AuthController.requestRegisterOtp);
authRouter.post('/register/verify-otp', AuthController.verifyRegisterOtp);
authRouter.post('/register/complete', registerCompleteIpLimiter, AuthController.completeRegistration);

// User login routes
authRouter.post('/login/request-otp', otpIpLimiter, AuthController.requestUserLoginOtp);
authRouter.post('/login/verify-otp', AuthController.verifyUserLoginOtp);
authRouter.post('/logout', authenticateUser, AuthController.logoutUser);

// Staff auth routes (mounted under /staff/auth in API)
export const staffAuthRouter = Router();

staffAuthRouter.post('/login/request-otp', otpIpLimiter, AuthController.requestStaffLoginOtp);
staffAuthRouter.post('/login/verify-otp', AuthController.verifyStaffLoginOtp);
staffAuthRouter.post('/logout', authenticateStaff, requireStaff, AuthController.logoutStaff);
