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

    let ssl: pg.PoolConfig['ssl'] | undefined = undefined;
    const isRemote =
      !connectionString.includes('localhost') &&
      !connectionString.includes('127.0.0.1') &&
      !connectionString.includes('::1');

    if (config.DATABASE_SSL || (config.NODE_ENV === 'production' && isRemote)) {
      ssl = {
        rejectUnauthorized: true,
        ca: config.DATABASE_SSL_CA ? config.DATABASE_SSL_CA : undefined,
      };
    }

    poolInstance = new Pool({
      connectionString,
      ssl,
      max: config.NODE_ENV === 'test' ? 20 : (Number(process.env.DATABASE_POOL_SIZE) || 10),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 30000,
    });

    poolInstance.on('connect', (client) => {
      client.query('SET statement_timeout = 30000; SET lock_timeout = 8000;').catch((err) => {
        logger.error({ err }, 'Failed to set session timeouts on database connection');
      });
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
