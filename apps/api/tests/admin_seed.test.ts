import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../src/db/index.js';
import { seedAdmin } from '../src/scripts/seedAdmin.js';
import { truncateAllTables } from './setup.js';

describe('Admin Seeding Script (seedAdmin)', () => {
  beforeEach(async () => {
    await truncateAllTables();
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_NAME;
    delete process.env.ADMIN_MOBILE;
  });

  it('fails with a clear error if ADMIN_EMAIL is missing', async () => {
    process.env.ADMIN_NAME = 'Admin User';
    process.env.ADMIN_MOBILE = '9876543210';

    await expect(seedAdmin()).rejects.toThrow(/ADMIN_EMAIL is required/);
  });

  it('fails with a clear error if ADMIN_MOBILE is missing', async () => {
    process.env.ADMIN_EMAIL = 'admin@booyah.win';
    process.env.ADMIN_NAME = 'Admin User';

    await expect(seedAdmin()).rejects.toThrow(
      /ADMIN_MOBILE is required in environment to seed admin/
    );
  });

  it('fails with a clear error if ADMIN_MOBILE is invalid', async () => {
    process.env.ADMIN_EMAIL = 'admin@booyah.win';
    process.env.ADMIN_NAME = 'Admin User';
    process.env.ADMIN_MOBILE = '12345'; // Invalid: not 10-digits starting 6-9

    await expect(seedAdmin()).rejects.toThrow(/ADMIN_MOBILE is invalid/);
  });

  it('successfully seeds admin when valid ADMIN_EMAIL, ADMIN_NAME, and ADMIN_MOBILE are provided', async () => {
    process.env.ADMIN_EMAIL = 'admin@booyah.win';
    process.env.ADMIN_NAME = 'Super Admin';
    process.env.ADMIN_MOBILE = '9876543210';

    await seedAdmin();

    const staffRes = await query(
      `SELECT id, role, name, email, mobile FROM staff WHERE email = 'admin@booyah.win'`
    );

    expect(staffRes.rowCount).toBe(1);
    const admin = staffRes.rows[0];
    expect(admin.role).toBe('admin');
    expect(admin.name).toBe('Super Admin');
    expect(admin.mobile).toBe('9876543210');

    // Running again is idempotent and does not create duplicate
    await seedAdmin();
    const countRes = await query(`SELECT count(*)::int as count FROM staff WHERE role = 'admin'`);
    expect(countRes.rows[0].count).toBe(1);
  });
});
