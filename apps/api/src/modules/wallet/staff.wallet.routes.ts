import { Router } from 'express';
import { authenticateStaff, requireStaff } from '../../middleware/auth.js';
import { staffWriteRateLimit } from '../../middleware/rateLimiters.js';
import { idParamHandler } from '../../middleware/validate.js';
import {
  staffGetDeposits,
  staffApproveDeposit,
  staffRejectDeposit,
  staffGetWithdrawals,
  staffMarkWithdrawalPaid,
  staffRejectWithdrawal,
} from './staff.wallet.controller.js';

export const staffWalletRouter = Router();

// All routes require staff authentication and are subject to write rate limit
staffWalletRouter.use(authenticateStaff, requireStaff, staffWriteRateLimit);
staffWalletRouter.param('id', idParamHandler);

// Deposits
staffWalletRouter.get('/deposits', staffGetDeposits);
staffWalletRouter.post('/deposits/:id/approve', staffApproveDeposit);
staffWalletRouter.post('/deposits/:id/reject', staffRejectDeposit);

// Withdrawals
staffWalletRouter.get('/withdrawals', staffGetWithdrawals);
staffWalletRouter.post('/withdrawals/:id/mark-paid', staffMarkWithdrawalPaid);
staffWalletRouter.post('/withdrawals/:id/reject', staffRejectWithdrawal);
