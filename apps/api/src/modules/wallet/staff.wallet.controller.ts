import { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import {
  listDepositsStaff,
  verifyDeposit,
  approveDeposit,
  rejectDeposit,
} from './deposit.staff.service.js';
import {
  listWithdrawalsStaff,
  verifyWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
} from './withdrawal.staff.service.js';

// ─── Deposits ─────────────────────────────────────────────────────────────────

export async function staffGetDeposits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit  = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await listDepositsStaff({ status, limit, cursor });
    res.status(200).json({ data: result });
  } catch (err) { next(err); }
}

export async function staffVerifyDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    await verifyDeposit(req.staff.id, req.staff.email, req.staff.role, req.params.id);
    res.status(200).json({ data: { message: 'Deposit verified' } });
  } catch (err) { next(err); }
}

export async function staffApproveDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    await approveDeposit(req.staff.id, req.staff.email, req.staff.role, req.params.id);
    res.status(200).json({ data: { message: 'Deposit approved' } });
  } catch (err) { next(err); }
}

export async function staffRejectDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const { reason } = req.body as { reason: string };
    if (!reason) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'reason is required', 400);
    await rejectDeposit(req.staff.id, req.staff.email, req.staff.role, req.params.id, reason);
    res.status(200).json({ data: { message: 'Deposit rejected' } });
  } catch (err) { next(err); }
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export async function staffGetWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit  = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await listWithdrawalsStaff({ status, limit, cursor });
    res.status(200).json({ data: result });
  } catch (err) { next(err); }
}

export async function staffVerifyWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    await verifyWithdrawal(req.staff.id, req.staff.email, req.staff.role, req.params.id);
    res.status(200).json({ data: { message: 'Withdrawal verified' } });
  } catch (err) { next(err); }
}

export async function staffMarkWithdrawalPaid(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const { payoutRef } = req.body as { payoutRef: string };
    if (!payoutRef) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'payoutRef is required', 400);
    await markWithdrawalPaid(req.staff.id, req.staff.email, req.staff.role, req.params.id, payoutRef);
    res.status(200).json({ data: { message: 'Withdrawal marked as paid' } });
  } catch (err) { next(err); }
}

export async function staffRejectWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Not authenticated', 401);
    const { reason } = req.body as { reason: string };
    if (!reason) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'reason is required', 400);
    await rejectWithdrawal(req.staff.id, req.staff.email, req.staff.role, req.params.id, reason);
    res.status(200).json({ data: { message: 'Withdrawal rejected' } });
  } catch (err) { next(err); }
}
