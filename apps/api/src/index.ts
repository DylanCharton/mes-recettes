import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createImageStore } from './lib/imageStore';
import { createLogger } from './lib/logger';
import { MIGRATIONS_DIR } from './paths';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const db = createDb(path.join(env.DATA_DIR, 'app.db'), MIGRATIONS_DIR);
const images = createImageStore(path.join(env.DATA_DIR, 'images'));
const app = createApp({
  db,
  logger,
  images,
  fetch: globalThis.fetch,
  auth: env.auth,
  publicOrigin: env.PUBLIC_URL ? new URL(env.PUBLIC_URL).origin : undefined,
  webDist: env.webDist,
});
for (const warning of env.warnings) logger.warn(warning);

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  logger.info(
    { port, dataDir: env.DATA_DIR, auth: env.auth.enabled, front: env.webDist ?? 'vite' },
    'API démarrée',
  );
});
