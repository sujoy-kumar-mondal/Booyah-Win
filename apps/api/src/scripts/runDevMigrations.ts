import path from 'path';
import { fileURLToPath } from 'url';
import { runner } from 'node-pg-migrate';
import { assertDatabaseSafety } from './scriptUtils.js';
import {
  getDatabaseSslConfig,
  isUntrustedCertificateError,
  UNTRUSTED_CERT_SAFE_REASON,
} from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runDevMigrations(): Promise<void> {
  assertDatabaseSafety(process.env.DATABASE_URL);

  const ssl = getDatabaseSslConfig(process.env.DATABASE_URL);
  const dbConfig = ssl
    ? { connectionString: process.env.DATABASE_URL!, ssl }
    : process.env.DATABASE_URL!;

  await runner({
    databaseUrl: dbConfig as any,
    dir: path.resolve(__dirname, '../../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    log: (msg) => console.log(msg),
  });
}

if (process.argv[1]?.includes('runDevMigrations')) {
  runDevMigrations()
    .then(() => {
      console.log('Migrations applied successfully.');
      process.exit(0);
    })
    .catch((err) => {
      if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
        console.error(UNTRUSTED_CERT_SAFE_REASON);
      } else {
        console.error('Migration failed:', err.message);
      }
      process.exit(1);
    });
}
