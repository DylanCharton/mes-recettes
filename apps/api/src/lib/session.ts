import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { AuthConfig } from '../env';
import { errorBody } from './errors';

const COOKIE = 'mr_session';
const ONE_YEAR = 365 * 24 * 60 * 60;

type EnabledAuth = Extract<AuthConfig, { enabled: true }>;

/**
 * Session = cookie signé (HMAC, `SESSION_SECRET`), sans table en base. Changer le secret
 * révoque toutes les sessions (spec § 18.2). Usage personnel sur appareils de confiance : 1 an.
 */
export async function openSession(c: Context, auth: EnabledAuth) {
  await setSignedCookie(c, COOKIE, `v1.${Date.now()}`, auth.sessionSecret, {
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

export async function hasSession(c: Context, auth: AuthConfig): Promise<boolean> {
  if (!auth.enabled) return true;
  const value = await getSignedCookie(c, auth.sessionSecret, COOKIE);
  return typeof value === 'string' && value.startsWith('v1.');
}

/** Exige une session, sauf pour les chemins publics (santé, connexion). */
export function requireSession(
  auth: AuthConfig,
  publicPaths: readonly string[],
): MiddlewareHandler {
  return async (c, next) => {
    if (!auth.enabled || publicPaths.includes(c.req.path) || (await hasSession(c, auth))) {
      return next();
    }
    return c.json(errorBody('UNAUTHORIZED', 'Connectez-vous pour continuer'), 401);
  };
}
