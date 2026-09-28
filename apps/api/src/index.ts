import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createLogger } from './lib/logger';
import { MIGRATIONS_DIR } from './paths';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const db = createDb(path.join(env.DATA_DIR, 'app.db'), MIGRATIONS_DIR);
const app = createApp({ db, logger });

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  logger.info({ port, dataDir: env.DATA_DIR }, 'API démarrée');
});
