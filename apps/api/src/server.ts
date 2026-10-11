import { createApp } from './app.js';
import { config, validateProductionEnv } from './config/index.js';
import { closePool } from './db/index.js';
import { isSchedulerTickRunning } from './modules/matches/scheduler.service.js';
import { logger } from './utils/logger.js';

// Production startup check
if (config.NODE_ENV === 'production') {
  try {
    validateProductionEnv(process.env);
    logger.info('Production environment validation succeeded');
  } catch (err: any) {
    logger.fatal({ err: err.message }, 'Production environment validation failed. Server refusing to start.');
    process.exit(1);
  }
}

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`Booyah Win API server running on port ${config.PORT} [NODE_ENV=${config.NODE_ENV}]`);
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
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

