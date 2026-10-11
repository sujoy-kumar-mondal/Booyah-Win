import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { TierService } from '../src/modules/admin/tiers/tier.service.js';
import crypto from 'crypto';

const app = createApp({ enableRateLimiting: false });

describe('Entry Tier Management (Section 10)', () => {
  let adminToken: string;
  let employeeToken: string;

  beforeEach(async () => {
    await truncateAllTables();

    // Admin setup
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin', 'admin@tier.in', '9999999999') RETURNING id`
    );
    const adminId = adminRes.rows[0].id.toString();
    const adminSid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
      adminSid,
      adminId,
    ]);
    adminToken = signSessionToken(
      { sub: adminId, typ: 'staff', sid: adminSid, role: 'admin' },
      '12h'
    );

    // Employee setup
    const empRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Emp', 'emp@tier.in', '9888888888') RETURNING id`
    );
    const empId = empRes.rows[0].id.toString();
    const empSid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
      empSid,
      empId,
    ]);
    employeeToken = signSessionToken(
      { sub: empId, typ: 'staff', sid: empSid, role: 'employee' },
      '12h'
    );
  });

  describe('Role Guards & Staff Access', () => {
    it('employee gets 403 on /admin/tiers endpoints', async () => {
      await request(app)
        .get('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          gameMode: 'battle_royale',
          teamMode: 'solo',
          entryFee: '10.00',
          positions: [{ position: 1, prize: '50.00' }],
        })
        .expect(403);
    });

    it('Change #5: employee CAN access GET /staff/entry-tiers', async () => {
      const res = await request(app)
        .get('/api/v1/staff/entry-tiers')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(res.body.data.tiers).toBeInstanceOf(Array);
    });
  });

  describe('Tier Creation & Validations', () => {
    it('rejects position gaps (e.g. position 1 and 3 without 2)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameMode: 'battle_royale',
          teamMode: 'solo',
          entryFee: '10.00',
          positions: [
            { position: 1, prize: '50.00' },
            { position: 3, prize: '20.00' },
          ],
        })
        .expect(400);

      expect(res.body.error.message).toMatch(/Missing position 2/);
    });

    it('rejects duplicate active tier on (gameMode, teamMode, entryFee)', async () => {
      const tierPayload = {
        gameMode: 'battle_royale',
        teamMode: 'solo',
        entryFee: '20.00',
        positions: [{ position: 1, prize: '100.00' }],
      };

      // First succeeds
      await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(tierPayload)
        .expect(201);

      // Duplicate fails with 409
      const dupRes = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(tierPayload)
        .expect(409);

      expect(dupRes.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('enforces Clash Squad constraints (teamMode=squad, 8 players, killPrice=0, only pos 1)', async () => {
      // 1. Clash squad with kill price > 0 fails
      await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameMode: 'clash_squad',
          teamMode: 'squad',
          entryFee: '50.00',
          killPrice: '10.00',
          maxPlayers: 8,
          minPlayers: 8,
          positions: [{ position: 1, prize: '75.00' }],
        })
        .expect(400);

      // 2. Clash squad with position > 1 fails
      await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameMode: 'clash_squad',
          teamMode: 'squad',
          entryFee: '50.00',
          killPrice: '0.00',
          maxPlayers: 8,
          minPlayers: 8,
          positions: [
            { position: 1, prize: '75.00' },
            { position: 2, prize: '25.00' },
          ],
        })
        .expect(400);
    });

    it('triggers profit guard warning when max possible payout exceeds minimum collected', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameMode: 'battle_royale',
          teamMode: 'solo',
          entryFee: '10.00',
          killPrice: '5.00',
          maxPlayers: 48,
          minPlayers: 24, // minCollected = 10 * 24 = 240
          positions: [
            { position: 1, prize: '200.00' },
            { position: 2, prize: '100.00' },
          ], // prizes = 300, maxPayout = 300 + 5*47 = 535 > 240
        })
        .expect(201);

      expect(res.body.data.warning).toBeDefined();
      expect(res.body.data.warning).toMatch(/Profit guard warning/);
    });

    it('profit guard uses each tier custom minPlayers and maxPlayers (Item 6)', async () => {
      // Custom tier: minPlayers = 40, entryFee = 10 -> collected = 400.
      // Prizes = 300, killPrice = 0 -> maxPayout = 300.
      // Since 400 >= 300, no profit warning is triggered.
      const safeRes = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameMode: 'battle_royale',
          teamMode: 'solo',
          entryFee: '10.00',
          killPrice: '0.00',
          maxPlayers: 40,
          minPlayers: 40,
          positions: [
            { position: 1, prize: '200.00' },
            { position: 2, prize: '100.00' },
          ],
        })
        .expect(201);

      expect(safeRes.body.data.warning).toBeUndefined();
    });
  });

  describe('Tier Soft-Deletion & Listing (Change #6)', () => {
    it('soft-deleted tier is excluded from admin and staff tier lists', async () => {
      const createRes = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameMode: 'battle_royale',
          teamMode: 'solo',
          entryFee: '15.00',
          positions: [{ position: 1, prize: '60.00' }],
        })
        .expect(201);

      const tierId = createRes.body.data.tier.id;

      // Soft delete
      await request(app)
        .delete(`/api/v1/admin/tiers/${tierId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify excluded from admin tier list
      const adminList = await request(app)
        .get('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(adminList.body.data.tiers.some((t: any) => t.id === tierId)).toBe(false);

      // Verify excluded from staff tier list
      const staffList = await request(app)
        .get('/api/v1/staff/entry-tiers')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(staffList.body.data.tiers.some((t: any) => t.id === tierId)).toBe(false);

      // Audit log was written in transaction
      const audit = await query(
        `SELECT action FROM audit_logs WHERE target_type = 'entry_tiers' AND target_id = $1`,
        [tierId]
      );
      expect(audit.rowCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Default Seed Tiers (Section 10.2 & Rule #10)', () => {
    it('seeds default Tier 1 and Tier 2 idempotently', async () => {
      await TierService.seedDefaultTiers();

      const tiers = await TierService.listTiers();
      expect(tiers.length).toBe(2);

      const t1 = tiers.find((t) => t.gameMode === 'battle_royale' && t.entryFee === '10.00');
      expect(t1).toBeDefined();
      expect(t1?.positions).toHaveLength(3);
      expect(t1?.positions[0].prize).toBe('50.00');

      const t2 = tiers.find((t) => t.gameMode === 'clash_squad' && t.entryFee === '50.00');
      expect(t2).toBeDefined();
      expect(t2?.positions).toHaveLength(1);
      expect(t2?.positions[0].prize).toBe('75.00');

      // Idempotent test
      await TierService.seedDefaultTiers();
      const tiersAfter = await TierService.listTiers();
      expect(tiersAfter.length).toBe(2);
    });
  });
});
