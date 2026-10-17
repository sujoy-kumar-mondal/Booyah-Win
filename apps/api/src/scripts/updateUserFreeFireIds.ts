import { config } from '../config/index.js';
import { closePool, query, isUntrustedCertificateError, UNTRUSTED_CERT_SAFE_REASON } from '../db/index.js';
import { assertDatabaseSafety } from './scriptUtils.js';

export async function updateUserFreeFireIds(): Promise<void> {
  const targetDb =
    config.NODE_ENV === 'test'
      ? config.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL
      : config.DATABASE_URL || process.env.DATABASE_URL;
  assertDatabaseSafety(targetDb);

  console.log('--- Inspecting and Updating User Free Fire IDs ---');

  const usersRes = await query<{
    id: number;
    name: string;
    email: string;
    mobile: string;
    ff_id: string;
    ff_name: string;
  }>(`
    SELECT id, name, email, mobile, ff_id, ff_name
    FROM users
    ORDER BY id ASC
  `);

  console.log(`Found ${usersRes.rows.length} total users in DB:`);
  for (const u of usersRes.rows) {
    console.log(` - ID: ${u.id}, Name: "${u.name}", Mobile: ${u.mobile}, FF_ID: "${u.ff_id}", FF_NAME: "${u.ff_name}"`);
  }

  // Predefined numeric UIDs (10-digit) for known sample players
  const playerUidMap: Record<string, string> = {
    '9811000001': '1981100001', // Aakash Sharma
    '9811000002': '1981100002', // Rohan Verma
    '9811000003': '1981100003', // Pooja Patel
    '9811000004': '1981100004', // Vikram Singh
    '9811000005': '1981100005', // Sneha Reddy
    '9811000006': '1981100006', // Kabir Das
    '9811000007': '1981100007', // Arjun Mehta
    '9811000008': '1981100008', // Riya Sen
  };

  const preservedNames = ['sujoy kumar mondal', 'sujoy kumar mondal bca'];

  let updatedCount = 0;
  for (const u of usersRes.rows) {
    const normalizedName = u.name.trim().toLowerCase();
    if (preservedNames.includes(normalizedName)) {
      console.log(`[PRESERVED] Skipping "${u.name}" (ID ${u.id}) with UID: ${u.ff_id}`);
      continue;
    }

    // Check if user has predefined numeric UID or if non-numeric
    let newFfId: string | null = null;
    if (playerUidMap[u.mobile]) {
      newFfId = playerUidMap[u.mobile];
    } else if (!/^\d+$/.test(u.ff_id)) {
      // If any other user has non-numeric ff_id, convert or assign deterministic numeric UID
      const digitsOnly = u.mobile.replace(/\D/g, '');
      newFfId = digitsOnly.length >= 6 ? digitsOnly : `200000000${u.id}`;
    }

    if (newFfId && u.ff_id !== newFfId) {
      await query('UPDATE users SET ff_id = $1 WHERE id = $2', [newFfId, u.id]);
      console.log(`[UPDATED] User "${u.name}" (ID ${u.id}): ${u.ff_id} -> ${newFfId}`);
      updatedCount++;
    } else {
      console.log(`[UNCHANGED] User "${u.name}" (ID ${u.id}) UID: ${u.ff_id}`);
    }
  }

  console.log(`\n✅ Completed: ${updatedCount} user account(s) updated to numeric Free Fire IDs.`);
}

if (process.argv[1]?.includes('updateUserFreeFireIds')) {
  updateUserFreeFireIds()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
        console.error(UNTRUSTED_CERT_SAFE_REASON);
      } else {
        console.error('Failed to update user Free Fire IDs:', err.message);
      }
      await closePool();
      process.exit(1);
    });
}
