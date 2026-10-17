import { createApp } from './app.js';
import { config, validateProductionEnv } from './config/index.js';
import {
  closePool,
  assertDatabaseConnection,
  isUntrustedCertificateError,
  UNTRUSTED_CERT_SAFE_REASON,
} from './db/index.js';
import { ensureDatabaseSchema } from './db/ensureSchema.js';
import { isSchedulerTickRunning, runSchedulerTick } from './modules/matches/scheduler.service.js';
import { logger } from './utils/logger.js';

// Production startup check (runs on any host when NODE_ENV=production, or whenever RENDER is true)
if (config.NODE_ENV === 'production' || process.env.RENDER === 'true' || process.env.RENDER === '1') {
  try {
    validateProductionEnv(process.env);
    logger.info('Production environment validation succeeded');
  } catch (err: any) {
    logger.fatal({ err: err.message }, 'Production environment validation failed. Server refusing to start.');
    process.exit(1);
  }
}

// Database startup connectivity check
try {
  await assertDatabaseConnection();
  logger.info('Database connection established successfully');
  await ensureDatabaseSchema();
} catch (err: any) {
  if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
    logger.fatal(UNTRUSTED_CERT_SAFE_REASON);
  } else {
    logger.fatal({ err: err.message }, 'Failed to connect to database at startup.');
  }
  process.exit(1);
}

const app = createApp();
const port = Number(process.env.PORT) || config.PORT || 3000;

const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Booyah Win API server running on port ${port} (0.0.0.0) [NODE_ENV=${config.NODE_ENV}]`);
});

// Background scheduler tick timer (runs every 30 seconds to auto-cancel expired matches, cleanup stale OTPs, etc.)
const SCHEDULER_TICK_INTERVAL_MS = 30_000;
const schedulerTimer = setInterval(() => {
  runSchedulerTick().catch((err) => {
    logger.error({ err: err.message }, 'Background scheduler tick execution error');
  });
}, SCHEDULER_TICK_INTERVAL_MS);
schedulerTimer.unref();

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearInterval(schedulerTimer);
  logger.info({ signal }, 'Graceful shutdown initiated. Stopping new HTTP connections...');

  // Fallback timer to force exit if hanging
  const forceExitTimeout = setTimeout(() => {
    logger.error('Shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
    } else {
      logger.info('HTTP server closed. In-flight requests finished.');
    }

    // Cover in-flight scheduler tick: log and wait for it to finish so next tick is not blocked
    if (isSchedulerTickRunning()) {
      logger.warn('In-flight scheduler tick detected during shutdown. Waiting for it to finish...');
      const start = Date.now();
      while (isSchedulerTickRunning() && Date.now() - start < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (isSchedulerTickRunning()) {
        logger.warn('Scheduler tick did not finish within 5s grace window; proceeding with pool shutdown.');
      } else {
        logger.info('Scheduler tick finished successfully before shutdown.');
      }
    }

    try {
      await closePool();
      logger.info('Database pool closed successfully.');
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Error closing database pool');
    }

    clearTimeout(forceExitTimeout);
    logger.info('Graceful shutdown complete. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

