import { Request, Response, NextFunction } from 'express';
import { paiseToString } from '@booyah/shared';
import { RULES } from '../../config/rules.js';
import { query } from '../../db/index.js';
import { SettingsService } from '../admin/settings/settings.service.js';

export class RulesController {
  static async getRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settingRes = await query<{ key: string; value: string }>(
        "SELECT key, value FROM app_settings WHERE key IN ('cashback_max_percent', 'referral_reward', 'min_withdrawal', 'invitation_text')"
      );
      const settingsMap: Record<string, string> = {};
      for (const row of settingRes.rows) {
        settingsMap[row.key] = row.value?.trim() || '';
      }

      const rawVal = settingsMap['cashback_max_percent'];
      const maxCashbackUsagePercent =
        rawVal !== undefined && rawVal !== '' ? Number(rawVal) : RULES.CASHBACK_ENTRY_FEE_CAP_PERCENT;

      const referralReward = settingsMap['referral_reward'] || paiseToString(RULES.REFERRAL_REWARD_PAISE);
      const minWithdrawal = settingsMap['min_withdrawal'] || paiseToString(RULES.MIN_WITHDRAWAL_PAISE);
      const invitationText =
        settingsMap['invitation_text'] ||
        'Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\nJoin tournaments, show your skills and win real cash prizes!';

      res.status(200).json({
        data: {
          referralReward,
          maxCashbackUsagePercent,
          minWithdrawal,
          invitationText,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMatchRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const gameMode = typeof req.query.gameMode === 'string' ? req.query.gameMode : undefined;
      const matchRules = await SettingsService.getMatchRules(gameMode);
      res.status(200).json({ data: matchRules });
    } catch (err) {
      next(err);
    }
  }
}
