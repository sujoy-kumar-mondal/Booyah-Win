import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import crypto from 'crypto';

const app = createApp({ enableRateLimiting: false });

describe('Admin Employee Management (Section 16.1)', () => {
  let adminId: string;
  let adminToken: string;
  let employeeId: string;
  let employeeToken: string;

  beforeEach(async () => {
    await truncateAllTables();

    // Create Admin
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile)
       VALUES ('admin', 'Super Admin', 'admin@booyah.win', '9999999999')
       RETURNING id`
    );
    adminId = adminRes.rows[0].id.toString();
    const adminSid = crypto.randomUUID();
    await query(
      `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`,
      [adminSid, adminId]
    );
    adminToken = signSessionToken(
      { sub: adminId, typ: 'staff', sid: adminSid, role: 'admin' },
      '12h'
    );

    // Create Employee
    const empRes = await query(
      `INSERT INTO staff (role, name, email, mobile)
       VALUES ('employee', 'Staff User', 'employee@booyah.win', '9888888888')
       RETURNING id`
    );
    employeeId = empRes.rows[0].id.toString();
    const empSid = crypto.randomUUID();
    await query(
      `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`,
      [empSid, employeeId]
    );
    employeeToken = signSessionToken(
      { sub: employeeId, typ: 'staff', sid: empSid, role: 'employee' },
      '12h'
    );
  });

  describe('Role Guards on /admin/employees', () => {
    it('rejects employee token with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('rejects unauthenticated requests with 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/v1/admin/employees').expect(401);
      expect(res.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
    });
  });

  describe('Employee Creation & Validations', () => {
    it('admin cannot create another admin (role is rejected / forced to employee)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Second Admin',
          mobile: '9777777777',
          email: 'admin2@booyah.win',
          role: 'admin',
        })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('creates employee, stores encrypted PAN/Aadhaar, and returns masked values', async () => {
      const res = await request(app)
        .post('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Karan Mehra',
          mobile: '9123456789',
          email: 'karan@booyah.win',
          pan: 'ABCDE1234F',
          aadhaar: '123456789012',
        })
        .expect(201);

      const emp = res.body.data.employee;
      expect(emp.name).toBe('Karan Mehra');
      expect(emp.email).toBe('karan@booyah.win');
      expect(emp.role).toBe('employee');
      // Rule #3: Exact masking
      expect(emp.pan).toBe('XXXXXX234F');
      expect(emp.aadhaar).toBe('XXXX XXXX 9012');

      // Verify stored as BYTEA buffer in database
      const dbRow = await query(
        'SELECT pan_enc, aadhaar_enc FROM staff WHERE id = $1',
        [emp.id]
      );
      expect(dbRow.rows[0].pan_enc).toBeInstanceOf(Buffer);
      expect(dbRow.rows[0].pan_enc.toString('utf8')).not.toContain('ABCDE1234F');

      // Rule #4 & Rule #9: Audit log exists in same transaction with NO plaintext PAN/Aadhaar
      const auditRes = await query(
        `SELECT action, target_type, target_id, details FROM audit_logs
         WHERE target_type = 'staff' AND target_id = $1 AND action = 'employee_created'`,
        [emp.id]
      );
      expect(auditRes.rowCount).toBe(1);
      const auditDetails = JSON.stringify(auditRes.rows[0].details);
      expect(auditRes.rows[0].action).toBe('employee_created');
      expect(auditDetails).not.toContain('ABCDE1234F');
      expect(auditDetails).not.toContain('123456789012');
    });
  });

  describe('Employee Listing & Filtering', () => {
    beforeEach(async () => {
      // Seed two employees
      await request(app)
        .post('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Suresh Kumar',
          mobile: '9111111111',
          email: 'suresh@booyah.win',
          pan: 'FGHIJ5678K',
        });

      await request(app)
        .post('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mahesh Sharma',
          mobile: '9222222222',
          email: 'mahesh@booyah.win',
        });
    });

    it('lists non-deleted employees with masked data', async () => {
      const res = await request(app)
        .get('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      const suresh = res.body.data.items.find((e: any) => e.email === 'suresh@booyah.win');
      expect(suresh.pan).toBe('XXXXXX678K');
    });

    it('filters employees by name or email with ILIKE', async () => {
      const res = await request(app)
        .get('/api/v1/admin/employees?q=suresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].email).toBe('suresh@booyah.win');
    });
  });

  describe('Employee Updates (PATCH /admin/employees/:id)', () => {
    let targetEmpId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Original Name',
          mobile: '9333333333',
          email: 'original@booyah.win',
          pan: 'ABCDE1234F',
          aadhaar: '123456789012',
        });
      targetEmpId = res.body.data.employee.id;
    });

    it('Rule #8: rejects role field on update', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/employees/${targetEmpId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('preserves existing PAN and Aadhaar when left blank / omitted', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/employees/${targetEmpId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.data.employee.name).toBe('Updated Name');
      expect(res.body.data.employee.pan).toBe('XXXXXX234F');
      expect(res.body.data.employee.aadhaar).toBe('XXXX XXXX 9012');
    });

    it('rejects duplicate email including soft-deleted staff email (409)', async () => {
      // Soft-delete employee@booyah.win
      await query(`UPDATE staff SET deleted_at = now() WHERE id = $1`, [employeeId]);

      // Attempt to change target's email to employee@booyah.win
      const res = await request(app)
        .patch(`/api/v1/admin/employees/${targetEmpId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'employee@booyah.win' })
        .expect(409);

      expect(res.body.error.code).toBe(ErrorCodes.EMAIL_EXISTS);
    });

    it('writes audit log for employee update', async () => {
      await request(app)
        .patch(`/api/v1/admin/employees/${targetEmpId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Name Change' })
        .expect(200);

      const audit = await query(
        `SELECT action, details FROM audit_logs
         WHERE target_type = 'staff' AND target_id = $1 AND action = 'employee_updated'`,
        [targetEmpId]
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0].details.updatedFields).toContain('name');
    });
  });

  describe('Employee Deletion & Session Invalidation', () => {
    it('admin cannot delete themselves', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/employees/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('soft-deletes employee, kills their session immediately, and blocks login', async () => {
      // 1. Employee is currently authenticated
      await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      // 2. Admin soft-deletes employee
      await request(app)
        .delete(`/api/v1/admin/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 3. Session row was deleted from sessions table
      const sessionCheck = await query(
        `SELECT id FROM sessions WHERE account_type = 'staff' AND account_id = $1`,
        [employeeId]
      );
      expect(sessionCheck.rowCount).toBe(0);

      // 4. Existing employee token is now rejected with 401
      const blockedRes = await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(401);
      expect(blockedRes.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);

      // 5. Excluded from employee list
      const listRes = await request(app)
        .get('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const existsInList = listRes.body.data.items.some((e: any) => e.id === employeeId);
      expect(existsInList).toBe(false);

      // 6. Audit log written
      const audit = await query(
        `SELECT action FROM audit_logs
         WHERE target_type = 'staff' AND target_id = $1 AND action = 'employee_deleted'`,
        [employeeId]
      );
      expect(audit.rowCount).toBe(1);
    });
  });
});
