import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import pkg from '../../package.json' with { type: 'json' };
import type { AppDeps } from '../app';

export function systemRoutes({ db }: AppDeps) {
  return new Hono().get('/health', (c) => {
    db.run(sql`select 1`);
    return c.json({ status: 'ok' as const, version: pkg.version });
  });
}
