import { Request, Response, NextFunction } from 'express';
import { paiseToString } from '@booyah/shared';
import { RULES } from '../../config/rules.js';
import { query } from '../../db/index.js';

export class RulesController {
  static async getRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settingRes = await query<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = 'cashback_max_percent'"
      );
      const rawVal = settingRes.rows[0]?.value?.trim();
      const maxCashbackUsagePercent =
        rawVal !== undefined && rawVal !== '' ? Number(rawVal) : RULES.CASHBACK_ENTRY_FEE_CAP_PERCENT;

      res.status(200).json({
        data: {
          referralReward: paiseToString(RULES.REFERRAL_REWARD_PAISE),
          maxCashbackUsagePercent,
          minWithdrawal: paiseToString(RULES.MIN_WITHDRAWAL_PAISE),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
