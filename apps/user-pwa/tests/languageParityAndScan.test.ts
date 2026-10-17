import { describe, it, expect } from 'vitest';
import { ErrorCodes } from '@booyah/shared';
import en from '../src/locales/en.json';
import bn from '../src/locales/bn.json';
import { ERROR_MESSAGES, ERROR_MESSAGES_BN } from '../src/api/errorMessages.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Requirement 7: Translation Parity, Error Messages & Component String Scan', () => {
  const enKeys = Object.keys(en);
  const bnKeys = Object.keys(bn);

  it('maintains 100% key parity between en.json and bn.json', () => {
    const missingInBn = enKeys.filter((k) => !(k in bn));
    const extraInBn = bnKeys.filter((k) => !(k in en));

    expect(missingInBn, `Missing in bn.json: ${missingInBn.join(', ')}`).toEqual([]);
    expect(extraInBn, `Extra in bn.json: ${extraInBn.join(', ')}`).toEqual([]);
    expect(bnKeys.length).toBe(enKeys.length);
  });

  it('contains non-empty translation strings for every key in both languages', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value === 'string' && value.trim().length > 0, `Empty en value for key: ${key}`).toBe(true);
    }
    for (const [key, value] of Object.entries(bn)) {
      expect(typeof value === 'string' && value.trim().length > 0, `Empty bn value for key: ${key}`).toBe(true);
    }
  });

  it('has a localized Bengali message for EVERY error code in ErrorCodes', () => {
    const errorCodesList = Object.values(ErrorCodes);
    expect(errorCodesList.length).toBeGreaterThanOrEqual(34);

    for (const code of errorCodesList) {
      // 1. In ERROR_MESSAGES_BN
      expect(ERROR_MESSAGES_BN[code], `Missing ERROR_MESSAGES_BN for code: ${code}`).toBeDefined();
      expect(ERROR_MESSAGES_BN[code].trim().length).toBeGreaterThan(0);

      // 2. In bn.json under errors.<code-name>
      const errorKey = `errors.${code}`;
      expect(bn[errorKey as keyof typeof bn], `Missing ${errorKey} in bn.json`).toBeDefined();
    }
  });

  it('ensures no raw key names leak into translation text', () => {
    // Translation strings must not be raw keys like "auth.someKey"
    const rawKeyPattern = /^(auth|common|nav|modal|landing|home|matches|wallet|leaderboard|profile|referral|support|maintenance|enums|errors)\.[a-zA-Z0-9_.-]+$/;

    for (const [key, value] of Object.entries(en)) {
      expect(rawKeyPattern.test(value), `Raw key leaked as value in en.json: ${key} => ${value}`).toBe(false);
    }
    for (const [key, value] of Object.entries(bn)) {
      expect(rawKeyPattern.test(value), `Raw key leaked as value in bn.json: ${key} => ${value}`).toBe(false);
    }
  });

  it('scans player components and pages to ensure translations are applied', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const checkedFiles = [
      path.join(srcDir, 'pages/Home.tsx'),
      path.join(srcDir, 'pages/Landing.tsx'),
      path.join(srcDir, 'pages/Matches.tsx'),
      path.join(srcDir, 'pages/Leaderboard.tsx'),
      path.join(srcDir, 'pages/Wallet.tsx'),
      path.join(srcDir, 'pages/Profile.tsx'),
      path.join(srcDir, 'pages/Referral.tsx'),
      path.join(srcDir, 'pages/Support.tsx'),
      path.join(srcDir, 'pages/Login.tsx'),
      path.join(srcDir, 'pages/Register.tsx'),
      path.join(srcDir, 'components/common/LanguageSelectionModal.tsx'),
      path.join(srcDir, 'components/common/MaintenanceBanner.tsx'),
      path.join(srcDir, 'components/common/SlowServerBanner.tsx'),
      path.join(srcDir, 'components/common/SessionReplacedModal.tsx'),
      path.join(srcDir, 'components/common/DownloadAppBanner.tsx'),
      path.join(srcDir, 'components/common/InstallationHelpModal.tsx'),
      path.join(srcDir, 'components/layout/AppLayout.tsx'),
      path.join(srcDir, 'components/layout/BottomNav.tsx'),
      path.join(srcDir, 'components/matches/MatchDetailModal.tsx'),
      path.join(srcDir, 'components/matches/MatchesList.tsx'),
      path.join(srcDir, 'components/matches/MatchHistory.tsx'),
      path.join(srcDir, 'components/matches/SoloJoinDialog.tsx'),
      path.join(srcDir, 'components/matches/TeamFormModal.tsx'),
      path.join(srcDir, 'components/matches/TeamManageModal.tsx'),
      path.join(srcDir, 'components/matches/TeamInvites.tsx'),
      path.join(srcDir, 'components/wallet/DepositForm.tsx'),
      path.join(srcDir, 'components/wallet/WithdrawForm.tsx'),
      path.join(srcDir, 'components/wallet/RequestsList.tsx'),
      path.join(srcDir, 'components/wallet/TransactionsList.tsx'),
      path.join(srcDir, 'components/referral/ShareButton.tsx'),
      path.join(srcDir, 'components/referral/ShareModal.tsx'),
    ];

    for (const file of checkedFiles) {
      expect(fs.existsSync(file), `Expected source file to exist: ${file}`).toBe(true);
      const content = fs.readFileSync(file, 'utf8');

      // Ensure useTranslation or t(...) or language is used
      const hasTranslationHook =
        content.includes('useTranslation') ||
        content.includes('LanguageSelectionModal') ||
        content.includes('setLanguageCookie');
      expect(
        hasTranslationHook,
        `File ${path.basename(file)} should use localization hooks or components`
      ).toBe(true);
    }
  });
});
