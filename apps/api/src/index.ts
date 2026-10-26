import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createImageStore } from './lib/imageStore';
import { createLogger } from './lib/logger';
import { MIGRATIONS_DIR } from './paths';
import { bootstrapAdmin, hasLoginableUser } from './services/users';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const db = createDb(path.join(env.DATA_DIR, 'app.db'), MIGRATIONS_DIR);
const images = createImageStore(path.join(env.DATA_DIR, 'images'));

// Premier compte : e-mail et mot de passe posés depuis l'environnement, une seule fois.
if (env.adminBootstrap && bootstrapAdmin(db, env.adminBootstrap)) {
  logger.info({ email: env.adminBootstrap.email }, 'Compte administrateur initialisé');
}
if (env.auth.enabled && !hasLoginableUser(db)) {
  logger.fatal(
    'Aucun compte ne peut se connecter : définissez ADMIN_EMAIL et AUTH_PASSWORD_HASH (§ 18.4).',
  );
  process.exit(1);
}

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
