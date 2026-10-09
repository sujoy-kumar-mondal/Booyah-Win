import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(config.PORT, () => {
  logger.info(`Booyah Win API server running on port ${config.PORT} [NODE_ENV=${config.NODE_ENV}]`);
});
