import dotenv from 'dotenv';
import path from 'path';

// Automatically load .env for scripts running from root or workspace directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export interface DbSafetyInfo {
  host: string;
  dbName: string;
  isRemote: boolean;
}

export function assertDatabaseSafety(
  rawDbUrl: string | undefined,
  argv: string[] = process.argv
): DbSafetyInfo {
  if (!rawDbUrl || rawDbUrl.trim() === '') {
    throw new Error('DATABASE_URL is not set.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawDbUrl);
  } catch {
    throw new Error('Invalid DATABASE_URL format.');
  }

  const host = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\//, '');
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const allowRemote = argv.includes('--allow-remote') || process.env.ALLOW_REMOTE === 'true';

  if (!isLocal) {
    if (!allowRemote) {
      throw new Error(
        `Safety check failed: Refusing to run script against remote database host "${host}". Pass --allow-remote to proceed.`
      );
    }
    console.log(`[SAFETY CHECK] Permitted remote database: host="${host}", db="${dbName}"`);
  } else {
    console.log(`[SAFETY CHECK] Local database: host="${host}", db="${dbName}"`);
  }

  return { host, dbName, isRemote: !isLocal };
}
