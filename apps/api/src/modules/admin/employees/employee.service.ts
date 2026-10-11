import { ErrorCodes } from '@booyah/shared';
import { query, withTransaction } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { writeAuditLog } from '../../../utils/audit.js';
import {
  decryptField,
  encryptField,
  maskAadhaar,
  maskPan,
} from '../../../utils/encryption.js';

export interface EmployeeDto {
  id: string;
  role: 'employee' | 'admin';
  name: string;
  email: string;
  mobile: string;
  pan: string | null;
  aadhaar: string | null;
  createdBy: string | null;
  createdAt: string;
}

export class EmployeeService {
  /**
   * Creates a new employee with encrypted PAN/Aadhaar.
   * Role is strictly forced to 'employee'.
   */
  static async createEmployee(
    adminId: string,
    input: {
      name: string;
      mobile: string;
      email: string;
      pan?: string;
      aadhaar?: string;
    }
  ): Promise<EmployeeDto> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check duplicate email across ALL staff (including soft-deleted, Rule #8)
    const existing = await query('SELECT id FROM staff WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new AppError(ErrorCodes.EMAIL_EXISTS, 'Staff email already exists', 409);
    }

    const panEnc = input.pan ? encryptField(input.pan.toUpperCase().trim()) : null;
    const aadhaarEnc = input.aadhaar ? encryptField(input.aadhaar.trim()) : null;

    return await withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO staff (role, name, mobile, email, pan_enc, aadhaar_enc, created_by)
         VALUES ('employee', $1, $2, $3, $4, $5, $6)
         RETURNING id, role, name, mobile, email, pan_enc, aadhaar_enc, created_by, created_at`,
        [input.name, input.mobile, normalizedEmail, panEnc, aadhaarEnc, adminId]
      );

      const row = res.rows[0];
      const newId = row.id.toString();

      // Rule #9: Audit rows inserted in the same transaction
      // Rule #4: Never log plaintext PAN or Aadhaar
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'employee_created',
        targetType: 'staff',
        targetId: newId,
        details: {
          email: normalizedEmail,
          name: input.name,
          mobile: input.mobile,
          hasPan: Boolean(input.pan),
          hasAadhaar: Boolean(input.aadhaar),
        },
      });

      return {
        id: newId,
        role: row.role,
        name: row.name,
        email: row.email,
        mobile: row.mobile,
        pan: maskPan(input.pan?.toUpperCase()),
        aadhaar: maskAadhaar(input.aadhaar),
        createdBy: row.created_by ? row.created_by.toString() : null,
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  /**
   * Lists employees with optional ILIKE search on name or email.
   */
  static async listEmployees(params: {
    q?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: EmployeeDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    const search = params.q ? `%${params.q.trim()}%` : null;

    let sql = `
      SELECT id, role, name, mobile, email, pan_enc, aadhaar_enc, created_by, created_at
      FROM staff
      WHERE deleted_at IS NULL
    `;
    const values: any[] = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      values.push(search);
      paramIndex++;
    }

    if (params.cursor) {
      sql += ` AND id < $${paramIndex}`;
      values.push(params.cursor);
      paramIndex++;
    }

    sql += ` ORDER BY id DESC LIMIT $${paramIndex}`;
    values.push(limit + 1);

    const res = await query(sql, values);
    const hasNext = res.rows.length > limit;
    const rows = hasNext ? res.rows.slice(0, limit) : res.rows;
    const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

    const items: EmployeeDto[] = rows.map((row) => {
      const decPan = decryptField(row.pan_enc);
      const decAadhaar = decryptField(row.aadhaar_enc);

      return {
        id: row.id.toString(),
        role: row.role,
        name: row.name,
        email: row.email,
        mobile: row.mobile,
        pan: maskPan(decPan),
        aadhaar: maskAadhaar(decAadhaar),
        createdBy: row.created_by ? row.created_by.toString() : null,
        createdAt: row.created_at.toISOString(),
      };
    });

    return { items, nextCursor };
  }

  /**
   * Updates an employee.
   * If PAN or Aadhaar is omitted / blank, keeps existing.
   */
  static async updateEmployee(
    adminId: string,
    employeeId: string,
    updates: {
      name?: string;
      mobile?: string;
      email?: string;
      pan?: string;
      aadhaar?: string;
    }
  ): Promise<EmployeeDto> {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT id, role, name, mobile, email, pan_enc, aadhaar_enc, created_by, created_at
         FROM staff WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [employeeId]
      );

      if (existingRes.rowCount === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Employee not found', 404);
      }

      const existing = existingRes.rows[0];

      // Check email uniqueness if changing email (including soft-deleted, Rule #8)
      if (updates.email && updates.email.toLowerCase() !== existing.email.toLowerCase()) {
        const emailCheck = await client.query(
          'SELECT id FROM staff WHERE email = $1 AND id != $2',
          [updates.email.toLowerCase(), employeeId]
        );
        if (emailCheck.rowCount && emailCheck.rowCount > 0) {
          throw new AppError(ErrorCodes.EMAIL_EXISTS, 'Staff email already exists', 409);
        }
      }

      let newPanEnc = existing.pan_enc;
      if (updates.pan !== undefined && updates.pan.trim() !== '') {
        newPanEnc = encryptField(updates.pan.toUpperCase().trim());
      }

      let newAadhaarEnc = existing.aadhaar_enc;
      if (updates.aadhaar !== undefined && updates.aadhaar.trim() !== '') {
        newAadhaarEnc = encryptField(updates.aadhaar.trim());
      }

      const newName = updates.name ?? existing.name;
      const newMobile = updates.mobile ?? existing.mobile;
      const newEmail = updates.email ? updates.email.toLowerCase().trim() : existing.email;

      const updateRes = await client.query(
        `UPDATE staff
         SET name = $1, mobile = $2, email = $3, pan_enc = $4, aadhaar_enc = $5
         WHERE id = $6
         RETURNING id, role, name, mobile, email, pan_enc, aadhaar_enc, created_by, created_at`,
        [newName, newMobile, newEmail, newPanEnc, newAadhaarEnc, employeeId]
      );

      const updated = updateRes.rows[0];

      // Rule #4 & Rule #9: Audit row inserted in transaction, log field names only
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'employee_updated',
        targetType: 'staff',
        targetId: employeeId,
        details: {
          updatedFields: Object.keys(updates),
        },
      });

      const decPan = decryptField(updated.pan_enc);
      const decAadhaar = decryptField(updated.aadhaar_enc);

      return {
        id: updated.id.toString(),
        role: updated.role,
        name: updated.name,
        email: updated.email,
        mobile: updated.mobile,
        pan: maskPan(decPan),
        aadhaar: maskAadhaar(decAadhaar),
        createdBy: updated.created_by ? updated.created_by.toString() : null,
        createdAt: updated.created_at.toISOString(),
      };
    });
  }

  /**
   * Soft deletes employee and destroys their active session.
   * Admin cannot delete themselves.
   */
  static async deleteEmployee(adminId: string, employeeId: string): Promise<void> {
    if (adminId === employeeId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Admin cannot delete themselves', 400);
    }

    await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE staff
         SET deleted_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [employeeId]
      );

      if (res.rowCount === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Employee not found', 404);
      }

      // Kill the session immediately
      await client.query(
        'DELETE FROM sessions WHERE account_type = $1 AND account_id = $2',
        ['staff', employeeId]
      );

      // Rule #9: Audit log in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'employee_deleted',
        targetType: 'staff',
        targetId: employeeId,
      });
    });
  }
}
