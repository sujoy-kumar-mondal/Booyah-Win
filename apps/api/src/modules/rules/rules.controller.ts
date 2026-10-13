import { Request, Response, NextFunction } from 'express';
import { paiseToString } from '@booyah/shared';
import { RULES } from '../../config/rules.js';

export class RulesController {
  static async getRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        data: {
          referralReward: paiseToString(RULES.REFERRAL_REWARD_PAISE),
          maxCashbackUsagePercent: RULES.CASHBACK_ENTRY_FEE_CAP_PERCENT,
          minWithdrawal: paiseToString(RULES.MIN_WITHDRAWAL_PAISE),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
