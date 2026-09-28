import { Hono } from 'hono';
import { z } from 'zod';
import { TagCreateSchema, TagRenameSchema } from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import { createTag, deleteTag, listTags, renameTag } from '../services/tags';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const tagNotFound = () => new AppError('NOT_FOUND', 404, 'Ce tag n’existe plus');

export function tagRoutes({ db }: AppDeps) {
  return new Hono()
    .get('/', (c) => c.json(listTags(db)))
    .post('/', validate('json', TagCreateSchema), (c) => {
      return c.json(createTag(db, c.req.valid('json').name), 201);
    })
    .patch('/:id', validate('param', IdParamSchema), validate('json', TagRenameSchema), (c) => {
      const { name, merge } = c.req.valid('json');
      const tag = renameTag(db, c.req.valid('param').id, name, merge);
      if (!tag) throw tagNotFound();
      return c.json(tag);
    })
    .delete('/:id', validate('param', IdParamSchema), (c) => {
      if (!deleteTag(db, c.req.valid('param').id)) throw tagNotFound();
      return c.body(null, 204);
    });
}
