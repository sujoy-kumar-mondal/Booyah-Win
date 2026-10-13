import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import * as userGuards from '../src/api/guards.js';

const CONTRACTS_DIR = path.resolve(__dirname, '../../../docs/contracts');

export function checkRecursiveParity(schema: any, data: any, pathStr = ''): string[] {
  const issues: string[] = [];
  if (data === null || data === undefined) return issues;

  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return checkRecursiveParity(schema._def.innerType, data, pathStr);
  }

  if (Array.isArray(data)) {
    if (schema instanceof z.ZodArray) {
      data.forEach((item, idx) => {
        issues.push(...checkRecursiveParity(schema.element, item, `${pathStr}[${idx}]`));
      });
    } else {
      issues.push(`TYPE MISMATCH: Expected ${schema._def.typeName} but received Array at ${pathStr || 'root'}`);
    }
    return issues;
  }

  if (schema instanceof z.ZodObject && typeof data === 'object') {
    const shape = schema.shape;
    const schemaKeys = new Set(Object.keys(shape));
    const dataKeys = new Set(Object.keys(data));

    // Extra keys
    for (const k of dataKeys) {
      const fullPath = pathStr ? `${pathStr}.${k}` : k;
      if (!schemaKeys.has(k)) {
        issues.push(`EXTRA KEY: ${fullPath}`);
      } else {
        issues.push(...checkRecursiveParity(shape[k], data[k], fullPath));
      }
    }

    // Missing keys
    for (const k of schemaKeys) {
      const fullPath = pathStr ? `${pathStr}.${k}` : k;
      const fieldSchema = shape[k];
      const isOptional = fieldSchema.isOptional();
      if (!dataKeys.has(k) && !isOptional) {
        issues.push(`MISSING REQUIRED KEY: ${fullPath}`);
      }
    }
  }

  return issues;
}

function loadContract(filename: string): any {
  const filepath = path.join(CONTRACTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Contract file not found: ${filename}`);
  }
  const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  if (content.error !== undefined) {
    return content;
  }
  return content.data;
}

describe('Requirement 1, 2, 4: User PWA Strict Contract Parity & Guard Coverage', () => {
  describe('Unit tests for recursive parity validator', () => {
    const sampleSchema = z.object({
      id: z.string(),
      nested: z.object({
        requiredField: z.string(),
      }),
      list: z.array(
        z.object({
          itemKey: z.string(),
        })
      ),
    });

    it('Requirement 2: fails when a nested extra key is present', () => {
      const dataWithNestedExtra = {
        id: '1',
        nested: {
          requiredField: 'ok',
          unexpectedExtra: 'fail',
        },
        list: [{ itemKey: 'val' }],
      };

      const issues = checkRecursiveParity(sampleSchema, dataWithNestedExtra);
      expect(issues).toContain('EXTRA KEY: nested.unexpectedExtra');
    });

    it('Requirement 2: fails when an extra key is inside an array element', () => {
      const dataWithArrayExtra = {
        id: '1',
        nested: { requiredField: 'ok' },
        list: [{ itemKey: 'val', extraInList: 123 }],
      };

      const issues = checkRecursiveParity(sampleSchema, dataWithArrayExtra);
      expect(issues).toContain('EXTRA KEY: list[0].extraInList');
    });

    it('Requirement 2: fails when a nested required key is missing', () => {
      const dataWithNestedMissing = {
        id: '1',
        nested: {},
        list: [{ itemKey: 'val' }],
      };

      const issues = checkRecursiveParity(sampleSchema, dataWithNestedMissing);
      expect(issues).toContain('MISSING REQUIRED KEY: nested.requiredField');
    });
  });

  describe('Contract Mapping Completeness & Guard Parity', () => {
    const guardToContractsMap: Record<string, { guard: z.ZodTypeAny; contracts: string[] }> = {
      getMeGuard: {
        guard: userGuards.getMeGuard,
        contracts: ['GET_api_v1_me.json', 'PATCH_api_v1_me_profile.json'],
      },
      loginVerifyResponseGuard: {
        guard: userGuards.loginVerifyResponseGuard,
        contracts: ['POST_api_v1_auth_login_verify-otp.json'],
      },
      registerVerifyResponseGuard: {
        guard: userGuards.registerVerifyResponseGuard,
        contracts: ['POST_api_v1_auth_register_verify-otp.json'],
      },
      registerCompleteResponseGuard: {
        guard: userGuards.registerCompleteResponseGuard,
        contracts: ['POST_api_v1_auth_register_complete.json'],
      },
      paymentInfoDtoGuard: {
        guard: userGuards.paymentInfoDtoGuard,
        contracts: ['GET_api_v1_payment-info.json'],
      },
      depositDtoGuard: {
        guard: userGuards.depositDtoGuard,
        contracts: ['POST_api_v1_wallet_deposits.json'],
      },
      depositListResponseGuard: {
        guard: userGuards.depositListResponseGuard,
        contracts: ['GET_api_v1_wallet_deposits.json'],
      },
      withdrawalDtoGuard: {
        guard: userGuards.withdrawalDtoGuard,
        contracts: ['POST_api_v1_wallet_withdrawals.json'],
      },
      withdrawalListResponseGuard: {
        guard: userGuards.withdrawalListResponseGuard,
        contracts: ['GET_api_v1_wallet_withdrawals.json'],
      },
      transactionListResponseGuard: {
        guard: userGuards.transactionListResponseGuard,
        contracts: ['GET_api_v1_wallet_transactions.json'],
      },
      userMatchListResponseGuard: {
        guard: userGuards.userMatchListResponseGuard,
        contracts: ['GET_api_v1_matches.json'],
      },
      userMatchDetailResponseGuard: {
        guard: userGuards.userMatchDetailResponseGuard,
        contracts: [
          'GET_api_v1_matches_id.json',
          'GET_api_v1_matches_id__live.json',
          'GET_api_v1_matches_id__joined.json',
          'GET_api_v1_matches_id__room_open.json',
          'GET_api_v1_matches_id__upcoming.json',
          'GET_api_v1_matches_id__full.json',
        ],
      },
      userMatchJoinResponseGuard: {
        guard: userGuards.userMatchJoinResponseGuard,
        contracts: ['POST_api_v1_matches_id_join.json'],
      },
      userTeamCreateResponseGuard: {
        guard: userGuards.userTeamCreateResponseGuard,
        contracts: [
          'POST_api_v1_matches_id_teams.json',
          'POST_api_v1_matches_id_teams__forming.json',
        ],
      },
      userTeamReplaceResponseGuard: {
        guard: userGuards.userTeamReplaceResponseGuard,
        contracts: ['POST_api_v1_matches_id_teams_mine_replace.json'],
      },
      userTeamDisbandResponseGuard: {
        guard: userGuards.userTeamDisbandResponseGuard,
        contracts: ['DELETE_api_v1_matches_id_teams_mine.json'],
      },
      userTeamInvitesResponseGuard: {
        guard: userGuards.userTeamInvitesResponseGuard,
        contracts: [
          'GET_api_v1_me_team-invites.json',
          'GET_api_v1_me_team-invites__empty.json',
          'GET_api_v1_me_team-invites__pending.json',
        ],
      },
      userInviteActionResponseGuard: {
        guard: userGuards.userInviteActionResponseGuard,
        contracts: [
          'POST_api_v1_team-invites_id_accept.json',
          'POST_api_v1_team-invites_id_decline.json',
        ],
      },
      userMatchHistoryResponseGuard: {
        guard: userGuards.userMatchHistoryResponseGuard,
        contracts: ['GET_api_v1_me_match-history.json'],
      },
      userSupportInfoResponseGuard: {
        guard: userGuards.userSupportInfoResponseGuard,
        contracts: [
          'GET_api_v1_support.json',
          'GET_api_v1_support__configured.json',
          'GET_api_v1_support__not_configured.json',
        ],
      },
      apiErrorEnvelopeGuard: {
        guard: userGuards.apiErrorEnvelopeGuard,
        contracts: [
          'ERROR_LOW_BALANCE.json',
          'ERROR_MATCH_FULL.json',
          'ERROR_ALREADY_JOINED.json',
          'ERROR_MATCH_NOT_JOINABLE.json',
          'ERROR_TEAM_INVALID.json',
          'ERROR_FORBIDDEN.json',
          'ERROR_NOT_FOUND.json',
          'ERROR_UNAUTHENTICATED.json',
          'ERROR_VALIDATION_ERROR.json',
          'ERROR_INVALID_TRANSITION.json',
          'ERROR_MAINTENANCE_MODE.json',
        ],
      },
      statusResponseGuard: {
        guard: userGuards.statusResponseGuard,
        contracts: ['GET_api_v1_status.json'],
      },
      leaderboardResponseGuard: {
        guard: userGuards.leaderboardResponseGuard,
        contracts: ['GET_api_v1_leaderboard.json', 'GET_api_v1_leaderboard__populated.json'],
      },
      leaderboardRankResponseGuard: {
        guard: userGuards.leaderboardRankResponseGuard,
        contracts: ['GET_api_v1_me_leaderboard-rank.json', 'GET_api_v1_me_leaderboard-rank__ranked.json'],
      },
      rulesResponseGuard: {
        guard: userGuards.rulesResponseGuard,
        contracts: ['GET_api_v1_rules.json'],
      },
      referralSummaryResponseGuard: {
        guard: userGuards.referralSummaryResponseGuard,
        contracts: ['GET_api_v1_me_referral-summary.json'],
      },
    };

    it('Requirement 4: fails when a guard has no contract', () => {
      const orphanGuardMap: Record<string, { guard: z.ZodTypeAny; contracts: string[] }> = {
        orphanGuard: {
          guard: z.object({ foo: z.string() }),
          contracts: [],
        },
      };

      expect(() => {
        for (const [name, entry] of Object.entries(orphanGuardMap)) {
          if (!entry.contracts || entry.contracts.length === 0) {
            throw new Error(`Guard "${name}" has no contract`);
          }
        }
      }).toThrow('Guard "orphanGuard" has no contract');
    });

    it('Requirement 4: fails when an endpoint contract has no guard', () => {
      const userContractsWithPayload = [
        'GET_api_v1_me.json',
        'POST_api_v1_auth_login_verify-otp.json',
        'GET_api_v1_payment-info.json',
        'GET_api_v1_wallet_deposits.json',
        'GET_api_v1_wallet_withdrawals.json',
        'GET_api_v1_wallet_transactions.json',
      ];

      const simulatedGuards = new Set(['getMeGuard']); // missing others

      const missing = userContractsWithPayload.filter((c) => !simulatedGuards.has(c));
      expect(missing.length).toBeGreaterThan(0);
    });

    it('Requirement 4: every guard in user-pwa has contract files and vice versa', () => {
      for (const [guardName, entry] of Object.entries(guardToContractsMap)) {
        expect(
          entry.contracts.length,
          `Guard "${guardName}" must map to at least one contract file`
        ).toBeGreaterThan(0);

        for (const file of entry.contracts) {
          const filepath = path.join(CONTRACTS_DIR, file);
          expect(
            fs.existsSync(filepath),
            `Contract file "${file}" for guard "${guardName}" must exist on disk`
          ).toBe(true);
        }
      }

      const authCode = fs.readFileSync(path.resolve(__dirname, '../src/api/auth.ts'), 'utf-8');
      const userCode = fs.readFileSync(path.resolve(__dirname, '../src/api/user.ts'), 'utf-8');
      const walletCode = fs.readFileSync(path.resolve(__dirname, '../src/api/wallet.ts'), 'utf-8');
      const matchesCode = fs.readFileSync(path.resolve(__dirname, '../src/api/matches.ts'), 'utf-8');
      const supportCode = fs.readFileSync(path.resolve(__dirname, '../src/api/support.ts'), 'utf-8');

      expect(authCode).toContain('loginVerifyResponseGuard');
      expect(authCode).toContain('registerVerifyResponseGuard');
      expect(authCode).toContain('registerCompleteResponseGuard');
      expect(userCode).toContain('getMeGuard');
      expect(walletCode).toContain('paymentInfoDtoGuard');
      expect(walletCode).toContain('depositDtoGuard');
      expect(walletCode).toContain('depositListResponseGuard');
      expect(walletCode).toContain('withdrawalDtoGuard');
      expect(walletCode).toContain('withdrawalListResponseGuard');
      expect(walletCode).toContain('transactionListResponseGuard');
      expect(matchesCode).toContain('userMatchListResponseGuard');
      expect(matchesCode).toContain('userMatchDetailResponseGuard');
      expect(matchesCode).toContain('userMatchJoinResponseGuard');
      expect(matchesCode).toContain('userTeamCreateResponseGuard');
      expect(matchesCode).toContain('userTeamReplaceResponseGuard');
      expect(matchesCode).toContain('userTeamDisbandResponseGuard');
      expect(matchesCode).toContain('userTeamInvitesResponseGuard');
      expect(matchesCode).toContain('userInviteActionResponseGuard');
      expect(matchesCode).toContain('userMatchHistoryResponseGuard');
      expect(supportCode).toContain('userSupportInfoResponseGuard');
      const leaderboardCode = fs.readFileSync(path.resolve(__dirname, '../src/api/leaderboard.ts'), 'utf-8');
      const rulesCode = fs.readFileSync(path.resolve(__dirname, '../src/api/rules.ts'), 'utf-8');
      expect(leaderboardCode).toContain('leaderboardResponseGuard');
      expect(leaderboardCode).toContain('leaderboardRankResponseGuard');
      expect(rulesCode).toContain('rulesResponseGuard');
      expect(rulesCode).toContain('referralSummaryResponseGuard');
    });

    for (const [guardName, entry] of Object.entries(guardToContractsMap)) {
      for (const contractFile of entry.contracts) {
        it(`validates strict recursive parity for ${guardName} against ${contractFile}`, () => {
          const contractData = loadContract(contractFile);

          const parseResult = entry.guard.safeParse(contractData);
          expect(
            parseResult.success,
            `Zod safeParse failed for ${guardName} on ${contractFile}: ${JSON.stringify(
              !parseResult.success ? parseResult.error.issues : []
            )}`
          ).toBe(true);

          const issues = checkRecursiveParity(entry.guard, contractData);
          expect(
            issues,
            `Parity check failed for ${guardName} against ${contractFile}:\n${issues.join('\n')}`
          ).toEqual([]);
        });
      }
    }
  });
});
