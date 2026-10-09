import pg, { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config, validateTestDatabaseUrl } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getDbUrl(): string {
  if (config.NODE_ENV === 'test') {
    return validateTestDatabaseUrl(config.TEST_DATABASE_URL);
  }
  return config.DATABASE_URL;
}

export function getPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = getDbUrl();
    if (!connectionString) {
      throw new Error(
        `Database connection string is missing for environment: ${config.NODE_ENV}`
      );
    }
    poolInstance = new Pool({
      connectionString,
      max: config.NODE_ENV === 'test' ? 10 : 20,
    });

    poolInstance.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error');
    });
  }
  return poolInstance;
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const pool = getPool();
  return pool.query<R>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
