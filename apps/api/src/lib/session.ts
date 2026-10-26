import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { SessionUser } from '@mes-recettes/shared';
import type { Db } from '../db/client';
import type { AuthConfig } from '../env';
import { DEFAULT_USER_ID, getUser } from '../services/users';
import { AppError, errorBody } from './errors';

const COOKIE = 'mr_session';
const ONE_YEAR = 365 * 24 * 60 * 60;

type EnabledAuth = Extract<AuthConfig, { enabled: true }>;

declare module 'hono' {
  interface ContextVariableMap {
    /** Compte de la requête, posé par `requireSession`. */
    user: SessionUser;
  }
}

/**
 * Session = cookie signé (HMAC, `SESSION_SECRET`) `v2.<compte>.<version>`, sans table en base.
 * Changer le mot de passe incrémente la version du compte (déconnecte ses autres appareils) ;
 * changer le secret révoque toutes les sessions (spec § 18.2). Appareils de confiance : 1 an.
 */
export async function openSession(
  c: Context,
  auth: EnabledAuth,
  user: { id: number; sessionVersion: number },
) {
  await setSignedCookie(c, COOKIE, `v2.${user.id}.${user.sessionVersion}`, auth.sessionSecret, {
    httpOnly: true,
    secure: auth.secureCookie,
    sameSite: 'Lax',
    path: '/',
    maxAge: ONE_YEAR,
  });
}

export function closeSession(c: Context, auth: EnabledAuth) {
  deleteCookie(c, COOKIE, { path: '/', secure: auth.secureCookie });
}

/** Compte de la session, ou `null` (cookie absent, falsifié, ancien format ou révoqué). */
export async function readSession(
  c: Context,
  auth: AuthConfig,
  db: Db,
): Promise<SessionUser | null> {
  if (!auth.enabled) return toSessionUser(getUser(db, DEFAULT_USER_ID));

  const value = await getSignedCookie(c, auth.sessionSecret, COOKIE);
  const match = typeof value === 'string' ? /^v2\.(\d+)\.(\d+)$/.exec(value) : null;
  if (!match) return null;
  const user = getUser(db, Number(match[1]));
  return user && user.sessionVersion === Number(match[2]) ? toSessionUser(user) : null;
}

function toSessionUser(user: ReturnType<typeof getUser>): SessionUser | null {
  if (!user) return null;
  const { sessionVersion: _version, ...sessionUser } = user;
  return sessionUser;
}

/** Exige une session et expose son compte (`c.get('user')`), sauf pour les chemins publics. */
export function requireSession(
  auth: AuthConfig,
  db: Db,
  isPublic: (path: string) => boolean,
): MiddlewareHandler {
  return async (c, next) => {
    if (isPublic(c.req.path)) return next();
    const user = await readSession(c, auth, db);
    if (!user) return c.json(errorBody('UNAUTHORIZED', 'Connectez-vous pour continuer'), 401);
    c.set('user', user);
    return next();
  };
}

/** Réservé aux administrateurs (invitations). */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (!c.get('user').isAdmin) {
    throw new AppError('FORBIDDEN', 403, 'Réservé à l’administrateur');
  }
  return next();
};
