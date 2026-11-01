import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';

const app = createApp({ enableRateLimiting: false });

describe('Important Updates API (/api/v1/updates & /api/v1/admin/updates)', () => {
  let adminToken: string;
  let employeeToken: string;

  beforeEach(async () => {
    await truncateAllTables();

    // Setup Admin
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin', 'admin@bw.in', '9999999999') RETURNING id`
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

    // Setup Employee
    const empRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Employee', 'emp@bw.in', '9888888888') RETURNING id`
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

  describe('Public GET /api/v1/updates', () => {
    it('returns empty list when no updates exist', async () => {
      const res = await request(app).get('/api/v1/updates').expect(200);
      expect(res.body.data.updates).toEqual([]);
    });

    it('returns only active updates ordered by sort_order ASC', async () => {
      // Create active update #1
      await request(app)
        .post('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Update 2',
          heading: 'Second Heading',
          dateDisplay: '20 Jul',
          sortOrder: 2,
          isActive: true,
          points: [{ label: 'Rule 2', text: 'Second rule' }],
        })
        .expect(201);

      // Create inactive update
      await request(app)
        .post('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Inactive Update',
          heading: 'Hidden',
          dateDisplay: '01 Jan',
          sortOrder: 0,
          isActive: false,
          points: [],
        })
        .expect(201);

      // Create active update #2 (should be first because sortOrder = 1)
      await request(app)
        .post('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Update 1',
          heading: 'First Heading',
          dateDisplay: '25 Jul',
          sortOrder: 1,
          isActive: true,
          linkUrl: '/matches',
          linkText: 'Join Match',
          points: [{ label: 'Rule 1', text: 'First rule' }],
        })
        .expect(201);

      const res = await request(app).get('/api/v1/updates').expect(200);
      expect(res.body.data.updates).toHaveLength(2);
      expect(res.body.data.updates[0].title).toBe('Update 1');
      expect(res.body.data.updates[0].linkUrl).toBe('/matches');
      expect(res.body.data.updates[0].linkText).toBe('Join Match');
      expect(res.body.data.updates[1].title).toBe('Update 2');
    });
  });

  describe('Admin Operations /api/v1/admin/updates', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app).get('/api/v1/admin/updates').expect(401);
    });

    it('rejects non-admin staff with 403', async () => {
      await request(app)
        .get('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('allows admin to create, update, and delete an important update with link', async () => {
      // 1. Create
      const createRes = await request(app)
        .post('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '🔥🚨 Important Notice - Snipers Ban',
          category: 'Announcement',
          dateDisplay: '28 May',
          heading: 'Weapon Restrictions in Squad & CS',
          points: [
            { label: 'Strict Ban', text: 'AWM and M82B are prohibited.' },
          ],
          notice: 'Zero score audit on violation.',
          linkUrl: 'https://chat.whatsapp.com/test',
          linkText: 'Join Official WhatsApp',
          sortOrder: 1,
          isActive: true,
        })
        .expect(201);

      const update = createRes.body.data.update;
      expect(update.id).toBeDefined();
      expect(update.title).toBe('🔥🚨 Important Notice - Snipers Ban');
      expect(update.linkUrl).toBe('https://chat.whatsapp.com/test');
      expect(update.linkText).toBe('Join Official WhatsApp');
      expect(update.points).toHaveLength(1);

      // 2. Read Admin List (includes inactive if any)
      const listRes = await request(app)
        .get('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listRes.body.data.updates).toHaveLength(1);

      // 3. Update
      const patchRes = await request(app)
        .patch(`/api/v1/admin/updates/${update.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '🔥🚨 Updated Notice - Snipers Ban',
          linkUrl: '/support',
          linkText: 'Contact Support',
          isActive: false,
        })
        .expect(200);

      expect(patchRes.body.data.update.title).toBe('🔥🚨 Updated Notice - Snipers Ban');
      expect(patchRes.body.data.update.linkUrl).toBe('/support');
      expect(patchRes.body.data.update.linkText).toBe('Contact Support');
      expect(patchRes.body.data.update.isActive).toBe(false);

      // Public list should now be empty because it is inactive
      const publicRes = await request(app).get('/api/v1/updates').expect(200);
      expect(publicRes.body.data.updates).toEqual([]);

      // 4. Delete
      await request(app)
        .delete(`/api/v1/admin/updates/${update.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin list should now be empty
      const afterDeleteRes = await request(app)
        .get('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(afterDeleteRes.body.data.updates).toEqual([]);
    });

    it('validates required fields on create', async () => {
      const res = await request(app)
        .post('/api/v1/admin/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
