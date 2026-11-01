import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';

const app = createApp({ enableRateLimiting: false });

// Valid 1x1 PNG image buffer for testing
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Valid 1x1 JPEG buffer
const TINY_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff,
  0xd9,
]);

describe('Banners API (/api/v1/banners & /api/v1/admin/banners)', () => {
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

  describe('Public GET /api/v1/banners', () => {
    it('returns empty list when no banners exist', async () => {
      const res = await request(app).get('/api/v1/banners').expect(200);
      expect(res.body.data.banners).toEqual([]);
    });

    it('returns only active banners ordered by sort_order ASC', async () => {
      // Create one active banner and one inactive banner
      await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TINY_PNG_BUFFER, 'banner1.png')
        .field('targetUrl', '/matches')
        .field('title', 'Second Banner')
        .field('sortOrder', '2')
        .field('isActive', 'true')
        .expect(201);

      await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TINY_PNG_BUFFER, 'banner2.png')
        .field('targetUrl', '/support')
        .field('title', 'First Banner')
        .field('sortOrder', '1')
        .field('isActive', 'true')
        .expect(201);

      await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TINY_PNG_BUFFER, 'banner3.png')
        .field('targetUrl', '/hidden')
        .field('title', 'Inactive Banner')
        .field('sortOrder', '0')
        .field('isActive', 'false')
        .expect(201);

      const res = await request(app).get('/api/v1/banners').expect(200);
      expect(res.body.data.banners).toHaveLength(2);
      expect(res.body.data.banners[0].title).toBe('First Banner');
      expect(res.body.data.banners[0].targetUrl).toBe('/support');
      expect(res.body.data.banners[0].imageUrl).toBeDefined();
      expect(res.body.data.banners[1].title).toBe('Second Banner');
      expect(res.body.data.banners[1].targetUrl).toBe('/matches');
    });
  });

  describe('Admin Operations (/api/v1/admin/banners)', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app).get('/api/v1/admin/banners').expect(401);
      await request(app).post('/api/v1/admin/banners').expect(401);
    });

    it('rejects employee requests (requires admin)', async () => {
      await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${employeeToken}`)
        .attach('image', TINY_PNG_BUFFER, 'banner.png')
        .field('targetUrl', '/matches')
        .expect(403);
    });

    it('validates required fields on create', async () => {
      // Missing image
      const noImageRes = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('targetUrl', '/matches')
        .expect(400);
      expect(noImageRes.body.error.message).toContain('image');

      // Missing targetUrl
      const noUrlRes = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TINY_PNG_BUFFER, 'banner.png')
        .expect(400);
      expect(noUrlRes.body.error.message).toContain('Target URL');
    });

    it('allows admin to add, update, and delete banner', async () => {
      // 1. Create banner
      const createRes = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TINY_PNG_BUFFER, 'banner.png')
        .field('targetUrl', '/matches')
        .field('title', 'Championship 2026')
        .field('sortOrder', '5')
        .field('isActive', 'true')
        .expect(201);

      const banner = createRes.body.data.banner;
      expect(banner.id).toBeDefined();
      expect(banner.title).toBe('Championship 2026');
      expect(banner.targetUrl).toBe('/matches');
      expect(banner.sortOrder).toBe(5);
      expect(banner.isActive).toBe(true);
      expect(banner.imageUrl).toBeDefined();

      // 2. Admin list includes all banners
      const listRes = await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listRes.body.data.banners).toHaveLength(1);

      // 3. Update banner link and replace image
      const updateRes = await request(app)
        .patch(`/api/v1/admin/banners/${banner.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TINY_JPEG_BUFFER, 'replacement.jpg')
        .field('targetUrl', '/support')
        .field('title', 'Support Hub')
        .field('sortOrder', '1')
        .field('isActive', 'false')
        .expect(200);

      const updatedBanner = updateRes.body.data.banner;
      expect(updatedBanner.title).toBe('Support Hub');
      expect(updatedBanner.targetUrl).toBe('/support');
      expect(updatedBanner.sortOrder).toBe(1);
      expect(updatedBanner.isActive).toBe(false);

      // 4. Delete banner
      await request(app)
        .delete(`/api/v1/admin/banners/${banner.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 5. Admin list is now empty
      const emptyRes = await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(emptyRes.body.data.banners).toHaveLength(0);
    });
  });
});
