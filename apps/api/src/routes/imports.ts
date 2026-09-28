import { Hono } from 'hono';
import { ImportPreviewRequestSchema } from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { rateLimit } from '../lib/rateLimit';
import { validate } from '../lib/validate';
import { previewImport } from '../services/imports';

export function importRoutes(deps: AppDeps) {
  return new Hono().post(
    '/preview',
    rateLimit({ limit: 10, windowMs: 60_000, maxConcurrent: 2 }),
    validate('json', ImportPreviewRequestSchema),
    async (c) => c.json(await previewImport(deps, c.req.valid('json'))),
  );
}
