import path from 'path';
import { fileURLToPath } from 'url';
import { runner } from 'node-pg-migrate';
import { validateTestDatabaseUrl } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runTestMigrations(): Promise<void> {
  const testDbUrl = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

  // Executes the exact same migrations folder as production / dev
  await runner({
    databaseUrl: testDbUrl,
    dir: path.resolve(__dirname, '../../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    log: () => {},
  });
}

if (process.argv[1]?.includes('runTestMigrations')) {
  runTestMigrations()
    .then(() => {
      console.log('Test migrations applied successfully using node-pg-migrate.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}
