import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { AppError } from '../lib/errors';
import { verifyPassword } from '../lib/password';
import { clientIp, rateLimit } from '../lib/rateLimit';
import { closeSession, hasSession, openSession } from '../lib/session';
import { validate } from '../lib/validate';

const LoginSchema = z.object({ password: z.string().min(1).max(200) });

export function authRoutes({ auth, logger }: AppDeps) {
  return new Hono()
    .get('/me', async (c) =>
      c.json({ authEnabled: auth.enabled, authenticated: await hasSession(c, auth) }),
    )
    .post(
      '/login',
      rateLimit({ limit: 5, windowMs: 60_000, key: clientIp }),
      // scrypt mobilise ~128 Mo par tentative : au plus 2 vérifications simultanées.
      rateLimit({ limit: Infinity, windowMs: 60_000, maxConcurrent: 2 }),
      validate('json', LoginSchema),
      async (c) => {
        if (!auth.enabled) return c.body(null, 204);
        if (!(await verifyPassword(c.req.valid('json').password, auth.passwordHash))) {
          logger.warn({ ip: clientIp(c) }, 'auth.login_failed');
          throw new AppError('INVALID_CREDENTIALS', 401, 'Mot de passe incorrect');
        }
        await openSession(c, auth);
        return c.body(null, 204);
      },
    )
    .post('/logout', (c) => {
      if (auth.enabled) closeSession(c, auth);
      return c.body(null, 204);
    });
}
