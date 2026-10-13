import crypto from 'crypto';
import {
  ErrorCodes,
  generateReferralCode,
  paiseToString,
  stringToPaise,
  UserDto,
  StaffDto,
  UserCooldownsDto,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { UsersService } from '../users/users.service.js';
import {
  generateOtp,
  hashOtp,
  signRegistrationToken,
  signSessionToken,
  verifyRegistrationToken,
} from '../../utils/crypto.js';
import { sendOtpEmail } from '../../utils/email.js';
import { RULES } from '../../config/rules.js';

export class AuthService {
  /**
   * Enforces OTP cooldown (60s) and hourly limits (max 5) on EVERY email,
   * registered or not, so 429 never reveals whether an account exists.
   */
  private static async checkOtpRateLimits(
    email: string,
    audience: 'user' | 'staff'
  ): Promise<void> {
    const cooldownRes = await query(
      `SELECT created_at FROM otp_requests
       WHERE email = $1 AND audience = $2 AND created_at > (now() - interval '60 seconds')
       ORDER BY created_at DESC LIMIT 1`,
      [email, audience]
    );

    if (cooldownRes.rowCount && cooldownRes.rowCount > 0) {
      throw new AppError(
        ErrorCodes.OTP_RATE_LIMITED,
        'Please wait 60 seconds before requesting another OTP',
        429
      );
    }

    const hourlyRes = await query(
      `SELECT count(*)::int as count FROM otp_requests
       WHERE email = $1 AND audience = $2 AND created_at > (now() - interval '1 hour')`,
      [email, audience]
    );

    const count = hourlyRes.rows[0]?.count || 0;
    if (count >= 5) {
      throw new AppError(
        ErrorCodes.OTP_RATE_LIMITED,
        'Too many OTP requests for this email. Please try again after an hour.',
        429
      );
    }
  }

  // ================= USER REGISTRATION =================

  static async requestRegisterOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists (Section 5.3: 409 EMAIL_EXISTS)
    const userRes = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userRes.rowCount && userRes.rowCount > 0) {
      throw new AppError(ErrorCodes.EMAIL_EXISTS, 'Already registered, please login', 409);
    }

    // 2. Rate limit check (cooldown & hourly)
    await this.checkOtpRateLimits(normalizedEmail, 'user');

    // 3. Generate and record OTP
    const otp = generateOtp();
    const codeHash = hashOtp(otp);

    await query(
      `INSERT INTO otp_requests (email, audience, purpose, code_hash, expires_at)
       VALUES ($1, 'user', 'register', $2, now() + interval '10 minutes')`,
      [normalizedEmail, codeHash]
    );

    // 4. Send email (or console log in dev/test)
    await sendOtpEmail(normalizedEmail, otp);

    return { message: 'OTP sent successfully' };
  }

  static async verifyRegisterOtp(
    email: string,
    otp: string
  ): Promise<{ registrationToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const otpId = await this.verifyOtpCore(normalizedEmail, otp, 'user', 'register');

    const registrationToken = signRegistrationToken({
      email: normalizedEmail,
      otpId: otpId.toString(),
      purpose: 'register',
    });

    return { registrationToken };
  }

  static async completeRegistration(input: {
    registrationToken: string;
    name: string;
    mobile: string;
    ffId: string;
    ffName: string;
    upiId: string;
    dateOfBirth: string;
    confirm18Plus: boolean;
    referralCode?: string;
  }): Promise<{ token: string; user: UserDto }> {
    let payload;
    try {
      payload = verifyRegistrationToken(input.registrationToken);
    } catch {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid or expired registration token', 401);
    }

    if (payload.purpose !== 'register') {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid token purpose', 401);
    }

    const email = payload.email.toLowerCase().trim();
    const otpId = payload.otpId;

    return await withTransaction(async (client) => {
      // 1. Verify the OTP request row is valid, verified, and not yet consumed
      const otpCheck = await client.query(
        `SELECT id, verified_at, consumed_at FROM otp_requests
         WHERE id = $1 AND email = $2 AND audience = 'user' AND purpose = 'register'
         FOR UPDATE`,
        [otpId, email]
      );

      if (otpCheck.rowCount === 0 || !otpCheck.rows[0].verified_at) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Registration verification record not found',
          401
        );
      }

      if (otpCheck.rows[0].consumed_at) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Registration token has already been consumed',
          401
        );
      }

      // 2. Uniqueness checks
      const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailCheck.rowCount && emailCheck.rowCount > 0) {
        throw new AppError(ErrorCodes.EMAIL_EXISTS, 'Email already registered', 409);
      }

      const mobileCheck = await client.query('SELECT id FROM users WHERE mobile = $1', [
        input.mobile,
      ]);
      if (mobileCheck.rowCount && mobileCheck.rowCount > 0) {
        throw new AppError(ErrorCodes.MOBILE_EXISTS, 'Mobile number already registered', 409);
      }

      const ffIdCheck = await client.query('SELECT id FROM users WHERE ff_id = $1', [input.ffId]);
      if (ffIdCheck.rowCount && ffIdCheck.rowCount > 0) {
        throw new AppError(ErrorCodes.FF_ID_EXISTS, 'Free Fire ID already registered', 409);
      }

      const upiCheck = await client.query(
        'SELECT id FROM users WHERE lower(upi_id) = lower($1)',
        [input.upiId]
      );
      if (upiCheck.rowCount && upiCheck.rowCount > 0) {
        throw new AppError(ErrorCodes.UPI_EXISTS, 'UPI ID already registered', 409);
      }

      // 3. Referral code validation (if provided)
      let referrerId: string | null = null;
      if (input.referralCode) {
        const refRes = await client.query(
          `SELECT id, mobile, ff_id, upi_id FROM users
           WHERE referral_code = $1 AND deleted_at IS NULL`,
          [input.referralCode.toUpperCase()]
        );

        if (refRes.rowCount === 0) {
          throw new AppError(ErrorCodes.INVALID_REFERRAL, 'Invalid referral code', 400);
        }

        const referrer = refRes.rows[0];
        // Prevent self-referral check (e.g. matching mobile, UPI, FF ID)
        if (
          referrer.mobile === input.mobile ||
          referrer.ff_id === input.ffId ||
          referrer.upi_id.toLowerCase() === input.upiId.toLowerCase()
        ) {
          throw new AppError(ErrorCodes.INVALID_REFERRAL, 'Cannot refer yourself', 400);
        }

        referrerId = referrer.id.toString();
      }

      // 4. Generate unique referral code for this user
      let newReferralCode = '';
      let codeUnique = false;
      while (!codeUnique) {
        newReferralCode = generateReferralCode();
        const existing = await client.query('SELECT id FROM users WHERE referral_code = $1', [
          newReferralCode,
        ]);
        if (existing.rowCount === 0) {
          codeUnique = true;
        }
      }

      // 5. Insert user
      const insertUserRes = await client.query(
        `INSERT INTO users (
           email, name, mobile, ff_id, ff_name, upi_id, date_of_birth,
           referral_code, referred_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, name, mobile, ff_id, ff_name, upi_id,
                   to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth,
                   referral_code, referred_by, created_at`,
        [
          email,
          input.name,
          input.mobile,
          input.ffId,
          input.ffName,
          input.upiId,
          input.dateOfBirth,
          newReferralCode,
          referrerId,
        ]
      );

      const userRow = insertUserRes.rows[0];
      const userId = userRow.id.toString();

      // 6. Create wallets (all zeroes)
      await client.query(
        'INSERT INTO wallets (user_id, add_money, cashback, winning) VALUES ($1, 0, 0, 0)',
        [userId]
      );

      // 7. If referred, insert referral record
      if (referrerId) {
        await client.query(
          'INSERT INTO referrals (referrer_id, referred_id, reward, credited_at) VALUES ($1, $2, $3, NULL)',
          [referrerId, userId, paiseToString(RULES.REFERRAL_REWARD_PAISE)]
        );
      }

      // 8. Create session (one active device only)
      const sessionId = crypto.randomUUID();
      await client.query(
        `INSERT INTO sessions (id, account_type, account_id, device_info)
         VALUES ($1, 'user', $2, NULL)
         ON CONFLICT (account_type, account_id)
         DO UPDATE SET id = EXCLUDED.id, created_at = now()`,
        [sessionId, userId]
      );

      // 9. Mark the register OTP row consumed
      await client.query('UPDATE otp_requests SET consumed_at = now() WHERE id = $1', [otpId]);

      // 10. Issue session JWT (30 days for user)
      const token = signSessionToken(
        {
          sub: userId,
          typ: 'user',
          sid: sessionId,
          role: 'user',
        },
        '30d'
      );

      const userDto: UserDto = {
        id: userId,
        email: userRow.email,
        name: userRow.name,
        mobile: userRow.mobile,
        ffId: userRow.ff_id,
        ffName: userRow.ff_name,
        upiId: userRow.upi_id,
        dateOfBirth: userRow.date_of_birth,
        referralCode: userRow.referral_code,
        referredBy: userRow.referred_by ? userRow.referred_by.toString() : null,
        createdAt: userRow.created_at.toISOString(),
      };

      return { token, user: userDto };
    });
  }

  // ================= USER LOGIN =================

  static async requestUserLoginOtp(email: string): Promise<{ message: string; registered?: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate limits apply to all emails, whether registered or not
    await this.checkOtpRateLimits(normalizedEmail, 'user');

    // 2. Check if user exists and is not deleted
    const userRes = await query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [normalizedEmail]
    );

    const exists = (userRes.rowCount ?? 0) > 0;
    const otp = generateOtp();
    const codeHash = hashOtp(otp);

    // Record otp_request so rate limits are tracked regardless of registration status
    await query(
      `INSERT INTO otp_requests (email, audience, purpose, code_hash, expires_at)
       VALUES ($1, 'user', 'login', $2, now() + interval '10 minutes')`,
      [normalizedEmail, codeHash]
    );

    if (exists) {
      await sendOtpEmail(normalizedEmail, otp);
    }

    // Generic response to prevent email enumeration, plus registered status for client UX
    return {
      message: 'If this email is registered, an OTP has been sent',
      registered: exists,
    };
  }

  static async verifyUserLoginOtp(
    email: string,
    otp: string
  ): Promise<{ token: string; user: UserDto }> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.verifyOtpCore(normalizedEmail, otp, 'user', 'login');

    const userRes = await query(
      `SELECT id, email, name, mobile, ff_id, ff_name, upi_id,
              to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth,
              referral_code, referred_by, deleted_at, created_at
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].deleted_at !== null) {
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP', 400);
    }

    const row = userRes.rows[0];
    const userId = row.id.toString();

    // Replace session (one active device)
    const sessionId = crypto.randomUUID();
    await query(
      `INSERT INTO sessions (id, account_type, account_id, device_info)
       VALUES ($1, 'user', $2, NULL)
       ON CONFLICT (account_type, account_id)
       DO UPDATE SET id = EXCLUDED.id, created_at = now()`,
      [sessionId, userId]
    );

    const token = signSessionToken(
      {
        sub: userId,
        typ: 'user',
        sid: sessionId,
        role: 'user',
      },
      '30d'
    );

    const userDto: UserDto = {
      id: userId,
      email: row.email,
      name: row.name,
      mobile: row.mobile,
      ffId: row.ff_id,
      ffName: row.ff_name,
      upiId: row.upi_id,
      dateOfBirth: row.date_of_birth,
      referralCode: row.referral_code,
      referredBy: row.referred_by ? row.referred_by.toString() : null,
      createdAt: row.created_at.toISOString(),
    };

    return { token, user: userDto };
  }

  static async logoutUser(userId: string): Promise<void> {
    await query('DELETE FROM sessions WHERE account_type = $1 AND account_id = $2', [
      'user',
      userId,
    ]);
  }

  // ================= STAFF LOGIN =================

  static async requestStaffLoginOtp(email: string): Promise<{ message: string; registered?: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate limits apply to all emails
    await this.checkOtpRateLimits(normalizedEmail, 'staff');

    // 2. Check staff
    const staffRes = await query(
      'SELECT id FROM staff WHERE email = $1 AND deleted_at IS NULL',
      [normalizedEmail]
    );

    const exists = (staffRes.rowCount ?? 0) > 0;
    const otp = generateOtp();
    const codeHash = hashOtp(otp);

    await query(
      `INSERT INTO otp_requests (email, audience, purpose, code_hash, expires_at)
       VALUES ($1, 'staff', 'login', $2, now() + interval '10 minutes')`,
      [normalizedEmail, codeHash]
    );

    if (exists) {
      await sendOtpEmail(normalizedEmail, otp);
    }

    return {
      message: 'If this email is registered, an OTP has been sent',
      registered: exists,
    };
  }

  static async verifyStaffLoginOtp(
    email: string,
    otp: string
  ): Promise<{ token: string; staff: StaffDto }> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.verifyOtpCore(normalizedEmail, otp, 'staff', 'login');

    const staffRes = await query(
      'SELECT id, role, name, email, mobile, deleted_at, created_at FROM staff WHERE email = $1',
      [normalizedEmail]
    );

    if (staffRes.rowCount === 0 || staffRes.rows[0].deleted_at !== null) {
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP', 400);
    }

    const row = staffRes.rows[0];
    const staffId = row.id.toString();

    // Replace session (one active device)
    const sessionId = crypto.randomUUID();
    await query(
      `INSERT INTO sessions (id, account_type, account_id, device_info)
       VALUES ($1, 'staff', $2, NULL)
       ON CONFLICT (account_type, account_id)
       DO UPDATE SET id = EXCLUDED.id, created_at = now()`,
      [sessionId, staffId]
    );

    // Staff expiry: 12 hours
    const token = signSessionToken(
      {
        sub: staffId,
        typ: 'staff',
        sid: sessionId,
        role: row.role,
      },
      '12h'
    );

    const staffDto: StaffDto = {
      id: staffId,
      role: row.role,
      name: row.name,
      email: row.email,
      mobile: row.mobile,
      createdAt: row.created_at.toISOString(),
    };

    return { token, staff: staffDto };
  }

  static async logoutStaff(staffId: string): Promise<void> {
    await query('DELETE FROM sessions WHERE account_type = $1 AND account_id = $2', [
      'staff',
      staffId,
    ]);
  }

  // ================= CORE OTP VERIFICATION =================

  private static async verifyOtpCore(
    email: string,
    otp: string,
    audience: 'user' | 'staff',
    purpose: 'register' | 'login'
  ): Promise<number> {
    const expectedHash = hashOtp(otp);

    const otpRes = await query(
      `SELECT id, code_hash, attempts, expires_at, verified_at
       FROM otp_requests
       WHERE email = $1 AND audience = $2 AND purpose = $3 AND verified_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, audience, purpose]
    );

    if (otpRes.rowCount === 0) {
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP', 400);
    }

    const row = otpRes.rows[0];

    // Check max 5 attempts lockout
    if (row.attempts >= 5) {
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP', 400);
    }

    // Check expiry (10 minutes)
    const now = new Date();
    if (now > new Date(row.expires_at)) {
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP', 400);
    }

    // Check code hash
    if (row.code_hash !== expectedHash) {
      // Increment attempts and commit immediately so it cannot be rolled back
      await query('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP', 400);
    }

    // Mark single-use verified
    await query('UPDATE otp_requests SET verified_at = now() WHERE id = $1', [row.id]);

    return Number(row.id);
  }

  // ================= PROFILE & WALLET HELPERS =================

  static async getUserProfileWithWallets(userId: string): Promise<{
    profile: UserDto;
    wallets: { addMoney: string; cashback: string; winning: string; total: string };
    cooldowns?: UserCooldownsDto;
  }> {
    return UsersService.getProfile(userId);
  }
}
