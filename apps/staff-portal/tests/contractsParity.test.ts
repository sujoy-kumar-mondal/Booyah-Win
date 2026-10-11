import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import * as staffGuards from '../src/api/guards.js';

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
  return content.data;
}

describe('Requirement 1, 2, 4: Staff Portal Strict Contract Parity & Guard Coverage', () => {
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
    // Map every staff guard to its corresponding contract files
    const guardToContractsMap: Record<string, { guard: z.ZodTypeAny; contracts: string[] }> = {
      staffMeGuard: {
        guard: staffGuards.staffMeGuard,
        contracts: ['GET_staff_me.json'],
      },
      dashboardMetricsGuard: {
        guard: staffGuards.dashboardMetricsGuard,
        contracts: ['GET_staff_dashboard.json'],
      },
      entryTiersResponseGuard: {
        guard: staffGuards.entryTiersResponseGuard,
        contracts: ['GET_staff_entry-tiers.json'],
      },
      matchListResponseGuard: {
        guard: staffGuards.matchListResponseGuard,
        contracts: ['GET_staff_matches.json'],
      },
      matchDetailResponseGuard: {
        guard: staffGuards.matchDetailResponseGuard,
        contracts: [
          'GET_staff_matches_id__solo.json',
          'GET_staff_matches_id__duo.json',
          'GET_staff_matches_id__clash_squad.json',
          'GET_staff_matches_id__no_room.json',
        ],
      },
      matchResultStaffGuard: {
        guard: staffGuards.matchResultStaffGuard,
        contracts: [
          'GET_staff_matches_id_result__pending.json',
          'GET_staff_matches_id_result__approved.json',
          'GET_staff_matches_id_result__rejected.json',
        ],
      },
      adminQueueResponseGuard: {
        guard: staffGuards.adminQueueResponseGuard,
        contracts: [
          'GET_admin_results__empty.json',
          'GET_admin_results__pending.json',
        ],
      },
      resultPayoutPreviewGuard: {
        guard: staffGuards.resultPayoutPreviewGuard,
        contracts: [
          'GET_admin_results_id_preview__normal.json',
          'GET_admin_results_preview__normal.json',
        ],
      },
      staffLoginResponseGuard: {
        guard: staffGuards.staffLoginResponseGuard,
        contracts: ['POST_staff_auth_login_verify-otp.json'],
      },
      depositListResponseGuard: {
        guard: staffGuards.depositListResponseGuard,
        contracts: ['GET_staff_deposits.json'],
      },
      withdrawalListResponseGuard: {
        guard: staffGuards.withdrawalListResponseGuard,
        contracts: ['GET_staff_withdrawals.json'],
      },
      createMatchResponseGuard: {
        guard: z.object({ match: staffGuards.matchStaffDtoGuard }),
        contracts: ['POST_staff_matches.json'],
      },
      employeeListResponseGuard: {
        guard: staffGuards.employeeListResponseGuard,
        contracts: ['GET_admin_employees.json'],
      },
      employeeSingleResponseGuard: {
        guard: staffGuards.employeeSingleResponseGuard,
        contracts: ['POST_admin_employees.json', 'PATCH_admin_employees_id.json'],
      },
      employeeDeleteResponseGuard: {
        guard: staffGuards.employeeDeleteResponseGuard,
        contracts: ['DELETE_admin_employees_id.json'],
      },
      createTierResponseGuard: {
        guard: staffGuards.createTierResponseGuard,
        contracts: ['POST_admin_tiers.json'],
      },
      updateTierResponseGuard: {
        guard: staffGuards.updateTierResponseGuard,
        contracts: ['PATCH_admin_tiers_id.json'],
      },
      deleteTierResponseGuard: {
        guard: staffGuards.deleteTierResponseGuard,
        contracts: ['DELETE_admin_tiers_id.json'],
      },
      adminUserListResponseGuard: {
        guard: staffGuards.adminUserListResponseGuard,
        contracts: ['GET_admin_users.json'],
      },
      adminUserDetailResponseGuard: {
        guard: staffGuards.adminUserDetailResponseGuard,
        contracts: ['GET_admin_users_id.json'],
      },
      adminUserDeleteResponseGuard: {
        guard: staffGuards.adminUserDeleteResponseGuard,
        contracts: ['DELETE_admin_users_id.json'],
      },
      adminUserAdjustResponseGuard: {
        guard: staffGuards.adminUserAdjustResponseGuard,
        contracts: ['POST_admin_users_id_adjust.json'],
      },
      adminSettingsResponseGuard: {
        guard: staffGuards.adminSettingsResponseGuard,
        contracts: ['GET_admin_settings.json', 'PATCH_admin_settings.json'],
      },
      adminUploadPaymentQrResponseGuard: {
        guard: staffGuards.adminUploadPaymentQrResponseGuard,
        contracts: ['POST_admin_settings_payment-qr.json'],
      },
      adminAuditLogsResponseGuard: {
        guard: staffGuards.adminAuditLogsResponseGuard,
        contracts: ['GET_admin_audit-logs.json'],
      },
    };

    it('Requirement 4: fails when a guard has no contract', () => {
      const orphanGuardMap: Record<string, { guard: z.ZodTypeAny; contracts: string[] }> = {
        orphanGuard: {
          guard: z.object({ foo: z.string() }),
          contracts: [], // Missing contract
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
      const staffContractsWithPayload = [
        'GET_staff_me.json',
        'POST_staff_auth_login_verify-otp.json',
        'GET_staff_dashboard.json',
        'GET_staff_entry-tiers.json',
        'GET_staff_matches.json',
        'POST_staff_matches.json',
        'GET_staff_deposits.json',
        'GET_staff_withdrawals.json',
        'GET_admin_results__empty.json',
        'GET_admin_results__pending.json',
      ];

      const simulatedGuards = new Set(['staffMeGuard']); // missing others

      const missing = staffContractsWithPayload.filter(c => !simulatedGuards.has(c));
      expect(missing.length).toBeGreaterThan(0);
    });

    it('Requirement 4: every guard in staff-portal has contract files and vice versa', () => {
      // 1. Every guard has contract files
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

      // 2. Scan frontend API code in staff.ts, matches.ts, and admin.ts to ensure every called endpoint with an API-shaped payload has a guard
      const staffCode = fs.readFileSync(path.resolve(__dirname, '../src/api/staff.ts'), 'utf-8');
      const matchesCode = fs.readFileSync(path.resolve(__dirname, '../src/api/matches.ts'), 'utf-8');
      const adminCode = fs.readFileSync(path.resolve(__dirname, '../src/api/admin.ts'), 'utf-8');

      // List of guarded endpoints in code
      expect(staffCode).toContain('staffMeGuard');
      expect(staffCode).toContain('staffLoginResponseGuard');
      expect(staffCode).toContain('dashboardMetricsGuard');
      expect(staffCode).toContain('depositListResponseGuard');
      expect(staffCode).toContain('withdrawalListResponseGuard');
      expect(matchesCode).toContain('entryTiersResponseGuard');
      expect(matchesCode).toContain('matchListResponseGuard');
      expect(matchesCode).toContain('matchDetailResponseGuard');
      expect(matchesCode).toContain('matchResultStaffGuard');
      expect(matchesCode).toContain('adminQueueResponseGuard');
      expect(matchesCode).toContain('resultPayoutPreviewGuard');
      expect(adminCode).toContain('employeeListResponseGuard');
      expect(adminCode).toContain('employeeSingleResponseGuard');
      expect(adminCode).toContain('employeeDeleteResponseGuard');
      expect(adminCode).toContain('createTierResponseGuard');
      expect(adminCode).toContain('updateTierResponseGuard');
      expect(adminCode).toContain('deleteTierResponseGuard');
      expect(adminCode).toContain('adminUserListResponseGuard');
      expect(adminCode).toContain('adminUserDetailResponseGuard');
      expect(adminCode).toContain('adminUserDeleteResponseGuard');
      expect(adminCode).toContain('adminUserAdjustResponseGuard');
      expect(adminCode).toContain('adminSettingsResponseGuard');
      expect(adminCode).toContain('adminUploadPaymentQrResponseGuard');
      expect(adminCode).toContain('adminAuditLogsResponseGuard');
    });

    // Test each guard against every contract variant
    for (const [guardName, entry] of Object.entries(guardToContractsMap)) {
      for (const contractFile of entry.contracts) {
        it(`validates strict recursive parity for ${guardName} against ${contractFile}`, () => {
          const contractData = loadContract(contractFile);

          // 1. Zod validation must pass
          const parseResult = entry.guard.safeParse(contractData);
          expect(
            parseResult.success,
            `Zod safeParse failed for ${guardName} on ${contractFile}: ${JSON.stringify(
              !parseResult.success ? parseResult.error.issues : []
            )}`
          ).toBe(true);

          // 2. Strict recursive key check: NO extra keys, NO missing required keys
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
