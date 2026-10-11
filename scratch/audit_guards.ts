import fs from 'fs';
import path from 'path';
import { z } from 'zod';

import * as staffGuards from '../apps/staff-portal/src/api/guards.js';
import * as pwaGuards from '../apps/user-pwa/src/api/guards.js';

const contractsDir = path.resolve('docs/contracts');

function getContractData(filename: string) {
  const fullPath = path.join(contractsDir, filename);
  const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  return content.data;
}

function checkSchemaDeep(schema: any, data: any, path = ''): string[] {
  const issues: string[] = [];
  if (data === null || data === undefined) return issues;

  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return checkSchemaDeep(schema._def.innerType, data, path);
  }

  if (Array.isArray(data)) {
    if (schema instanceof z.ZodArray) {
      data.forEach((item, idx) => {
        issues.push(...checkSchemaDeep(schema.element, item, `${path}[${idx}]`));
      });
    }
    return issues;
  }

  if (schema instanceof z.ZodObject && typeof data === 'object') {
    const shape = schema.shape;
    const schemaKeys = new Set(Object.keys(shape));
    const dataKeys = new Set(Object.keys(data));

    for (const k of dataKeys) {
      const fullPath = path ? `${path}.${k}` : k;
      if (!schemaKeys.has(k)) {
        issues.push(`EXTRA KEY: ${fullPath}`);
      } else {
        issues.push(...checkSchemaDeep(shape[k], data[k], fullPath));
      }
    }

    for (const k of schemaKeys) {
      const fullPath = path ? `${path}.${k}` : k;
      const fieldSchema = shape[k];
      const isOpt = fieldSchema.isOptional();
      if (!dataKeys.has(k) && !isOpt) {
        issues.push(`MISSING REQUIRED KEY: ${fullPath}`);
      }
    }
  }

  return issues;
}

const tests = [
  // Staff
  { name: 'GET_staff_me', guard: staffGuards.staffMeGuard, file: 'GET_staff_me.json' },
  { name: 'GET_staff_dashboard', guard: staffGuards.dashboardMetricsGuard, file: 'GET_staff_dashboard.json' },
  { name: 'GET_staff_entry-tiers', guard: staffGuards.entryTiersResponseGuard, file: 'GET_staff_entry-tiers.json' },
  { name: 'GET_staff_matches', guard: staffGuards.matchListResponseGuard, file: 'GET_staff_matches.json' },
  { name: 'GET_staff_matches_id__solo', guard: staffGuards.matchDetailResponseGuard, file: 'GET_staff_matches_id__solo.json' },
  { name: 'GET_staff_matches_id__duo', guard: staffGuards.matchDetailResponseGuard, file: 'GET_staff_matches_id__duo.json' },
  { name: 'GET_staff_matches_id__clash_squad', guard: staffGuards.matchDetailResponseGuard, file: 'GET_staff_matches_id__clash_squad.json' },
  { name: 'GET_staff_matches_id__no_room', guard: staffGuards.matchDetailResponseGuard, file: 'GET_staff_matches_id__no_room.json' },
  { name: 'GET_staff_matches_id_result__pending', guard: staffGuards.matchResultStaffGuard, file: 'GET_staff_matches_id_result__pending.json' },
  { name: 'GET_staff_matches_id_result__approved', guard: staffGuards.matchResultStaffGuard, file: 'GET_staff_matches_id_result__approved.json' },
  { name: 'GET_staff_matches_id_result__rejected', guard: staffGuards.matchResultStaffGuard, file: 'GET_staff_matches_id_result__rejected.json' },
  { name: 'GET_admin_results__empty', guard: staffGuards.adminQueueResponseGuard, file: 'GET_admin_results__empty.json' },
  { name: 'GET_admin_results__pending', guard: staffGuards.adminQueueResponseGuard, file: 'GET_admin_results__pending.json' },
  { name: 'GET_admin_results_id_preview__normal', guard: staffGuards.resultPayoutPreviewGuard, file: 'GET_admin_results_id_preview__normal.json' },
  { name: 'GET_admin_results_preview__normal', guard: staffGuards.resultPayoutPreviewGuard, file: 'GET_admin_results_preview__normal.json' },
  { name: 'GET_staff_deposits', guard: staffGuards.depositListResponseGuard, file: 'GET_staff_deposits.json' },
  { name: 'GET_staff_withdrawals', guard: staffGuards.withdrawalListResponseGuard, file: 'GET_staff_withdrawals.json' },
  { name: 'POST_staff_matches', guard: z.object({ match: staffGuards.matchStaffDtoGuard }), file: 'POST_staff_matches.json' },
  // PWA
  { name: 'GET_api_v1_me', guard: pwaGuards.getMeGuard, file: 'GET_api_v1_me.json' },
  { name: 'PATCH_api_v1_me_profile', guard: pwaGuards.getMeGuard, file: 'PATCH_api_v1_me_profile.json' },
  { name: 'GET_api_v1_payment-info', guard: pwaGuards.paymentInfoDtoGuard, file: 'GET_api_v1_payment-info.json' },
  { name: 'POST_api_v1_wallet_deposits', guard: pwaGuards.depositDtoGuard, file: 'POST_api_v1_wallet_deposits.json' },
  { name: 'GET_api_v1_wallet_deposits', guard: pwaGuards.depositListResponseGuard, file: 'GET_api_v1_wallet_deposits.json' },
  { name: 'POST_api_v1_wallet_withdrawals', guard: pwaGuards.withdrawalDtoGuard, file: 'POST_api_v1_wallet_withdrawals.json' },
  { name: 'GET_api_v1_wallet_withdrawals', guard: pwaGuards.withdrawalListResponseGuard, file: 'GET_api_v1_wallet_withdrawals.json' },
  { name: 'GET_api_v1_wallet_transactions', guard: pwaGuards.transactionListResponseGuard, file: 'GET_api_v1_wallet_transactions.json' },
  { name: 'POST_api_v1_auth_login_verify-otp', guard: pwaGuards.loginVerifyResponseGuard, file: 'POST_api_v1_auth_login_verify-otp.json' },
  { name: 'POST_api_v1_auth_register_verify-otp', guard: pwaGuards.registerVerifyResponseGuard, file: 'POST_api_v1_auth_register_verify-otp.json' },
  { name: 'POST_api_v1_auth_register_complete', guard: pwaGuards.registerCompleteResponseGuard, file: 'POST_api_v1_auth_register_complete.json' },
];

for (const t of tests) {
  const data = getContractData(t.file);
  const issues = checkSchemaDeep(t.guard, data);
  if (issues.length > 0) {
    console.log(`[ISSUES FOUND in ${t.name}] (${t.file}):`);
    for (const iss of issues) {
      console.log(`  - ${iss}`);
    }
  } else {
    console.log(`[PERFECT MATCH] ${t.name}`);
  }
}
