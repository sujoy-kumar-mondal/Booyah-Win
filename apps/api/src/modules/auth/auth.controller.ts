import { Request, Response, NextFunction } from 'express';
import {
  completeRegistrationSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '@booyah/shared';
import { AuthService } from './auth.service.js';

export class AuthController {
  // User Registration
  static async requestRegisterOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = requestOtpSchema.parse(req.body);
      const result = await AuthService.requestRegisterOtp(email);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async verifyRegisterOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyRegisterOtp(email, otp);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async completeRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = completeRegistrationSchema.parse(req.body);
      const result = await AuthService.completeRegistration(input);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // User Login
  static async requestUserLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = requestOtpSchema.parse(req.body);
      const result = await AuthService.requestUserLoginOtp(email);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async verifyUserLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyUserLoginOtp(email, otp);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async logoutUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await AuthService.logoutUser(req.user.id);
      }
      res.status(200).json({ data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  }

  // Staff Login
  static async requestStaffLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = requestOtpSchema.parse(req.body);
      const result = await AuthService.requestStaffLoginOtp(email);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async verifyStaffLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyStaffLoginOtp(email, otp);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async logoutStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.staff) {
        await AuthService.logoutStaff(req.staff.id);
      }
      res.status(200).json({ data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  }
}
