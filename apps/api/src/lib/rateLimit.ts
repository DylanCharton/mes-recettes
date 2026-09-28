import type { MiddlewareHandler } from 'hono';
import { AppError } from './errors';

type Options = { limit: number; windowMs: number; maxConcurrent?: number };

/**
 * Limiteur en mémoire, global à l'instance (usage mono-utilisateur) : `limit` requêtes par
 * fenêtre glissante et au plus `maxConcurrent` en parallèle (spec § 18.1).
 */
export function rateLimit({
  limit,
  windowMs,
  maxConcurrent = Infinity,
}: Options): MiddlewareHandler {
  const hits: number[] = [];
  let inFlight = 0;

  return async (_c, next) => {
    const now = Date.now();
    while (hits.length > 0 && hits[0]! <= now - windowMs) hits.shift();

    if (hits.length >= limit || inFlight >= maxConcurrent) {
      throw new AppError('RATE_LIMITED', 429, 'Trop de tentatives, réessayez dans une minute');
    }

    hits.push(now);
    inFlight++;
    try {
      await next();
    } finally {
      inFlight--;
    }
  };
}
