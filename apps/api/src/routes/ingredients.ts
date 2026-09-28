import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { validate } from '../lib/validate';
import { searchIngredients } from '../services/recipes';

const QuerySchema = z.object({ q: z.string().trim().max(60).default('') });

export function ingredientRoutes({ db }: AppDeps) {
  return new Hono().get('/', validate('query', QuerySchema), (c) =>
    c.json(searchIngredients(db, c.req.valid('query').q)),
  );
}
