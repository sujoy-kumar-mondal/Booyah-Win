import { paiseToString, stringToPaise } from '@booyah/shared';
import { query, withTransaction } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { writeAuditLog } from '../../../utils/audit.js';
import { uploadScreenshot, getSignedUrl, deleteFile } from '../../../utils/storage.js';

export const DEFAULT_SETTINGS: Record<string, string> = {
  min_deposit: '10.00',
  max_deposit: '5000.00',
  admin_approval_threshold: '2000.00',
  support_name: '',
  support_phone: '',
  support_email: '',
  support_hours: '10:00 AM - 10:00 PM IST',
  payment_upi_id: '',
  payment_qr_url: '',
  payment_qr_key: '',
};

export class SettingsService {
  /**
   * Idempotent seed for app_settings table defaults.
   */
  static async seedDefaults(): Promise<void> {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await query(
        `INSERT INTO app_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
  }

  /**
   * Returns all settings as a key-value map.
   */
  static async getAllSettings(): Promise<Record<string, string>> {
    const res = await query('SELECT key, value FROM app_settings');
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    if (settings.payment_qr_key && settings.payment_qr_key.trim()) {
      try {
        const qrUrl = await getSignedUrl(settings.payment_qr_key.trim(), 3600);
        if (qrUrl) {
          settings.payment_qr_url = qrUrl;
        }
      } catch {
        // ignore storage/signing error
      }
    }
    return settings;
  }

  /**
   * Returns public support details (Section 14).
   * Does not expose individual employee numbers.
   */
  static async getSupportInfo(): Promise<{
    supportName: string;
    supportPhone: string;
    supportEmail: string;
    supportHours: string;
  }> {
    const settings = await this.getAllSettings();
    return {
      supportName: settings.support_name || 'Booyah Win Support',
      supportPhone: settings.support_phone || '',
      supportEmail: settings.support_email || '',
      supportHours: settings.support_hours || '10:00 AM - 10:00 PM IST',
    };
  }

  /**
   * Returns payment details (Section 7.1).
   * While payment_upi_id is empty, returns clear "not configured" response. QR is optional.
   */
  static async getPaymentInfo(): Promise<{
    configured: boolean;
    message?: string;
    paymentUpiId?: string | null;
    paymentQrUrl?: string | null;
    qrUrl?: string | null;
    minDeposit: string;
    maxDeposit: string;
  }> {
    const settings = await this.getAllSettings();
    const upiId = settings.payment_upi_id?.trim() || '';

    if (!upiId) {
      return {
        configured: false,
        message: 'Payment information not configured yet',
        paymentUpiId: null,
        paymentQrUrl: null,
        qrUrl: null,
        minDeposit: settings.min_deposit || '10.00',
        maxDeposit: settings.max_deposit || '5000.00',
      };
    }

    let qrUrl: string | null = null;
    if (settings.payment_qr_key && settings.payment_qr_key.trim()) {
      try {
        qrUrl = await getSignedUrl(settings.payment_qr_key.trim(), 3600);
      } catch {
        qrUrl = null;
      }
    } else if (settings.payment_qr_url && settings.payment_qr_url.trim()) {
      qrUrl = settings.payment_qr_url.trim();
    }

    return {
      configured: true,
      paymentUpiId: upiId,
      paymentQrUrl: qrUrl,
      qrUrl,
      minDeposit: settings.min_deposit || '10.00',
      maxDeposit: settings.max_deposit || '5000.00',
    };
  }

  /**
   * Admin updates settings. Validates money limits and writes audit log in transaction.
   * Rejects direct modification of payment_qr_key (only upload endpoint writes it).
   */
  static async updateSettings(
    adminId: string,
    updates: Record<string, string | undefined>
  ): Promise<Record<string, string>> {
    if ('payment_qr_key' in updates && updates.payment_qr_key !== undefined) {
      throw new AppError(
        'VALIDATION_ERROR',
        'payment_qr_key cannot be updated directly; use the upload endpoint',
        400
      );
    }

    const current = await this.getAllSettings();

    // Check money limits logic if provided
    const newMin = updates.min_deposit ?? current.min_deposit;
    const newMax = updates.max_deposit ?? current.max_deposit;

    const minPaise = stringToPaise(newMin);
    const maxPaise = stringToPaise(newMax);

    if (minPaise <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Minimum deposit must be greater than zero', 400);
    }
    if (maxPaise < minPaise) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Maximum deposit cannot be less than minimum deposit',
        400
      );
    }

    if (updates.admin_approval_threshold) {
      const thresholdPaise = stringToPaise(updates.admin_approval_threshold);
      if (thresholdPaise <= 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Admin approval threshold must be greater than zero',
          400
        );
      }
    }

    return await withTransaction(async (client) => {
      const keysToUpdate: string[] = [];

      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) {
          keysToUpdate.push(key);
          await client.query(
            `INSERT INTO app_settings (key, value, updated_by, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (key)
             DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [key, val, adminId]
          );
        }
      }

      // Rule #9: Audit row in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'settings_updated',
        targetType: 'app_settings',
        details: { updatedKeys: keysToUpdate },
      });

      // Load all settings
      const res = await client.query('SELECT key, value FROM app_settings');
      const updatedMap: Record<string, string> = { ...DEFAULT_SETTINGS };
      for (const row of res.rows) {
        updatedMap[row.key] = row.value;
      }
      if (updatedMap.payment_qr_key && updatedMap.payment_qr_key.trim()) {
        try {
          const qrUrl = await getSignedUrl(updatedMap.payment_qr_key.trim(), 3600);
          if (qrUrl) {
            updatedMap.payment_qr_url = qrUrl;
          }
        } catch {
          // ignore storage/signing error
        }
      }
      return updatedMap;
    });
  }

  /**
   * Upload payment QR image:
   * - Uploads file (validates <= 2MB, magic bytes).
   * - Updates payment_qr_key in app_settings in transaction.
   * - If commit fails, deletes the new file.
   * - If commit succeeds, deletes the old file (if any).
   */
  static async uploadPaymentQr(
    adminId: string,
    fileBuffer: Buffer
  ): Promise<{ paymentQrKey: string; qrUrl: string }> {
    const newKey = await uploadScreenshot(fileBuffer);

    let oldKey: string | null = null;
    try {
      await withTransaction(async (client) => {
        const curr = await client.query(
          "SELECT value FROM app_settings WHERE key = 'payment_qr_key' FOR UPDATE"
        );
        if (curr.rowCount && curr.rows[0].value) {
          oldKey = curr.rows[0].value.trim();
        }

        await client.query(
          `INSERT INTO app_settings (key, value, updated_by, updated_at)
           VALUES ('payment_qr_key', $1, $2, now())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [newKey, adminId]
        );

        await writeAuditLog(client, {
          staffId: adminId,
          action: 'settings_payment_qr_updated',
          targetType: 'app_settings',
          details: { oldKey, newKey },
        });
      });
    } catch (err) {
      try {
        await deleteFile(newKey);
      } catch {
        // ignore delete failure on rollback
      }
      throw err;
    }

    // Delete old image only after successful commit
    if (oldKey && oldKey !== newKey) {
      try {
        await deleteFile(oldKey);
      } catch {
        // ignore delete error for old file
      }
    }

    const qrUrl = await getSignedUrl(newKey, 3600);
    return { paymentQrKey: newKey, qrUrl };
  }
}
