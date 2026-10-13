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

export const UNTRUSTED_CERT_SAFE_REASON =
  "The database certificate is not trusted. Set DATABASE_SSL_CA, DATABASE_SSL_CA_BASE64 or DATABASE_SSL_CA_FILE to Supabase's CA certificate";

export function isUntrustedCertificateError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.cause?.code;
  const untrustedCodes = [
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'CERT_UNTRUSTED',
    'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  ];
  if (code && untrustedCodes.includes(code)) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('self-signed') ||
    msg.includes('self signed') ||
    msg.includes('unable to verify the first certificate') ||
    msg.includes('unable to get local issuer certificate')
  );
}

export function getDatabaseSslConfig(connectionString?: string): pg.PoolConfig['ssl'] | undefined {
  const url = connectionString || getDbUrl();
  const isRemote =
    !url.includes('localhost') &&
    !url.includes('127.0.0.1') &&
    !url.includes('::1');

  if (config.DATABASE_SSL || isRemote || !!config.DATABASE_SSL_CA) {
    return {
      rejectUnauthorized: true,
      ca: config.DATABASE_SSL_CA ? config.DATABASE_SSL_CA : undefined,
    };
  }
  return undefined;
}

export function getPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = getDbUrl();
    if (!connectionString) {
      throw new Error(
        `Database connection string is missing for environment: ${config.NODE_ENV}`
      );
    }

    const ssl = getDatabaseSslConfig(connectionString);

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
      if (isUntrustedCertificateError(err)) {
        logger.fatal(UNTRUSTED_CERT_SAFE_REASON);
      } else {
        logger.error({ err }, 'Unexpected database pool error');
      }
    });
  }
  return poolInstance;
}

export async function assertDatabaseConnection(targetPool: pg.Pool = getPool()): Promise<void> {
  try {
    await targetPool.query('SELECT 1');
  } catch (err: any) {
    if (isUntrustedCertificateError(err)) {
      throw new Error(UNTRUSTED_CERT_SAFE_REASON);
    }
    throw err;
  }
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
