import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { query } from '../../db/index.js';
import { submitDeposit, listUserDeposits } from './deposit.service.js';
import { requestWithdrawal, listUserWithdrawals } from './withdrawal.service.js';
import { listTransactions } from './transactions.service.js';

// SEC-01: Zod validation schemas at controller boundary
export const depositRequestSchema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid positive amount'),
  utr: z.string().trim().regex(/^[A-Za-z0-9]{10,25}$/, 'UTR must be 10-25 alphanumeric characters'),
});

export const withdrawalRequestSchema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid positive amount'),
  upiId: z.string().trim().min(3).max(100),
  confirm: z.boolean().refine((val) => val === true, {
    message: 'confirm must be true',
  }),
});

// Multer – memory storage, 2 MB limit enforced in storage util
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const screenshotUpload = upload.single('screenshot');

// ─── Deposits ─────────────────────────────────────────────────────────────────

export async function createDeposit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);

    if (!req.file) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Screenshot is required', 400);
    }

    const validated = depositRequestSchema.parse(req.body);

    const result = await submitDeposit(req.user.id, validated.amount, validated.utr, req.file.buffer);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getDeposits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await listUserDeposits(req.user.id, { limit, cursor });
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export async function createWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);

    const rawUpiId = req.body?.upiId ?? req.body?.upi_id;
    const rawConfirm = req.body?.confirm ?? req.body?.confirm_upi;
    const validated = withdrawalRequestSchema.parse({
      amount: req.body?.amount,
      upiId: rawUpiId,
      confirm: rawConfirm,
    });

    // Read latest upi_id and upi_changed_at directly from DB (not stale req.user)
    const userRow = await query(
      'SELECT upi_id, upi_changed_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!userRow.rows[0]) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'User not found', 401);

    const result = await requestWithdrawal(
      req.user.id,
      userRow.rows[0].upi_id,
      userRow.rows[0].upi_changed_at,
      validated.amount,
      validated.upiId,
      validated.confirm
    );
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getWithdrawals(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await listUserWithdrawals(req.user.id, { limit, cursor });
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const type   = typeof req.query.type === 'string' ? req.query.type : undefined;
    const limit  = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await listTransactions(req.user.id, { type, limit, cursor });
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}
