import type { Context, MiddlewareHandler } from 'hono';
import { AppError } from './errors';

type Options = {
  limit: number;
  windowMs: number;
  maxConcurrent?: number;
  /** Clé de comptage (IP pour la connexion) ; par défaut un compteur unique pour l'instance. */
  key?: (c: Context) => string;
};

/**
 * Adresse du client. Derrière Caddy (seul point d'entrée, aucun port publié), la première
 * valeur de X-Forwarded-For est fiable ; en direct, l'en-tête est absent.
 */
export const clientIp = (c: Context) =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'direct';

/**
 * Limiteur en mémoire : `limit` requêtes par fenêtre glissante et au plus `maxConcurrent`
 * en parallèle, par clé (spec § 18.1). Suffisant pour une instance unique.
 */
export function rateLimit({
  limit,
  windowMs,
  maxConcurrent = Infinity,
  key = () => 'global',
}: Options): MiddlewareHandler {
  const hits = new Map<string, number[]>();
  const inFlight = new Map<string, number>();

  return async (c, next) => {
    const id = key(c);
    const now = Date.now();
    const recent = (hits.get(id) ?? []).filter((time) => time > now - windowMs);

    if (recent.length >= limit || (inFlight.get(id) ?? 0) >= maxConcurrent) {
      hits.set(id, recent);
      throw new AppError('RATE_LIMITED', 429, 'Trop de tentatives, réessayez dans une minute');
    }

    recent.push(now);
    hits.set(id, recent);
    inFlight.set(id, (inFlight.get(id) ?? 0) + 1);
    try {
      await next();
    } finally {
      inFlight.set(id, (inFlight.get(id) ?? 1) - 1);
    }
  };
}
