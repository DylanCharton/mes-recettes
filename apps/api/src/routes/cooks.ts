import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import { deleteCook, listCooks } from '../services/cooks';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Frise « Je l'ai faite ! » ; l'ajout se fait sur la recette (POST /api/recipes/:id/cooks). */
export function cookRoutes({ db }: AppDeps) {
  return new Hono()
    .get('/', (c) => c.json(listCooks(db, c.get('user').id)))
    .delete('/:id', validate('param', IdParamSchema), (c) => {
      if (!deleteCook(db, c.get('user').id, c.req.valid('param').id)) {
        throw new AppError('NOT_FOUND', 404, 'Cette réalisation n’existe plus');
      }
      return c.body(null, 204);
    });
}
