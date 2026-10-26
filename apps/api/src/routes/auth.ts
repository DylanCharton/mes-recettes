import { Hono } from 'hono';
import { z } from 'zod';
import { InvitationAcceptSchema, LoginSchema, PasswordChangeSchema } from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { AppError } from '../lib/errors';
import { clientIp, rateLimit } from '../lib/rateLimit';
import { closeSession, openSession, readSession } from '../lib/session';
import { validate } from '../lib/validate';
import { acceptInvitation, authenticate, changePassword, checkInvitation } from '../services/users';

const TokenParamSchema = z.object({ token: z.string().min(20).max(64) });

/** Routes publiques (connexion, invitations reçues), sauf `/password`. */
export function authRoutes({ auth, db, logger }: AppDeps) {
  // scrypt mobilise ~128 Mo par calcul : au plus 2 simultanés pour toutes ces routes.
  const scryptSlots = rateLimit({ limit: Infinity, windowMs: 60_000, maxConcurrent: 2 });

  return new Hono()
    .get('/me', async (c) => {
      const user = await readSession(c, auth, db);
      return c.json({ authEnabled: auth.enabled, authenticated: user !== null, user });
    })
    .post(
      '/login',
      rateLimit({ limit: 5, windowMs: 60_000, key: clientIp }),
      scryptSlots,
      validate('json', LoginSchema),
      async (c) => {
        if (!auth.enabled) return c.body(null, 204);
        const { email, password } = c.req.valid('json');
        const user = await authenticate(db, email, password);
        if (!user) {
          logger.warn({ ip: clientIp(c) }, 'auth.login_failed');
          throw new AppError('INVALID_CREDENTIALS', 401, 'E-mail ou mot de passe incorrect');
        }
        await openSession(c, auth, user);
        return c.body(null, 204);
      },
    )
    .post('/logout', (c) => {
      if (auth.enabled) closeSession(c, auth);
      return c.body(null, 204);
    })
    .post(
      '/password',
      rateLimit({ limit: 5, windowMs: 60_000, key: clientIp }),
      scryptSlots,
      validate('json', PasswordChangeSchema),
      async (c) => {
        const { currentPassword, newPassword } = c.req.valid('json');
        const { id } = c.get('user');
        const { sessionVersion } = await changePassword(db, id, currentPassword, newPassword);
        // Cet appareil reste connecté ; les autres sessions du compte sont révoquées.
        if (auth.enabled) await openSession(c, auth, { id, sessionVersion });
        logger.info({ userId: id }, 'auth.password_changed');
        return c.body(null, 204);
      },
    )
    .get(
      '/invitations/:token',
      rateLimit({ limit: 20, windowMs: 60_000, key: clientIp }),
      validate('param', TokenParamSchema),
      (c) => c.json(checkInvitation(db, c.req.valid('param').token)),
    )
    .post(
      '/invitations/:token/accept',
      rateLimit({ limit: 5, windowMs: 60_000, key: clientIp }),
      scryptSlots,
      validate('param', TokenParamSchema),
      validate('json', InvitationAcceptSchema),
      async (c) => {
        const user = await acceptInvitation(db, c.req.valid('param').token, c.req.valid('json'));
        if (auth.enabled) await openSession(c, auth, user);
        logger.info({ userId: user.id }, 'auth.account_created');
        return c.body(null, 201);
      },
    );
}
