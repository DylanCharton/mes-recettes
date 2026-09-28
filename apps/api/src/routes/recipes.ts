import { Hono } from 'hono';
import { z } from 'zod';
import { RecipeInputSchema, RecipeListQuerySchema, RecipePatchSchema } from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { AppError, recipeNotFound } from '../lib/errors';
import { validate } from '../lib/validate';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  patchRecipe,
  updateRecipe,
} from '../services/recipes';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export function recipeRoutes({ db, images }: AppDeps) {
  const assertImageExists = (imagePath: string | null | undefined) => {
    if (imagePath && !images.exists(imagePath)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Image introuvable, renvoyez-la');
    }
  };

  return new Hono()
    .get('/', validate('query', RecipeListQuerySchema), (c) => {
      return c.json(listRecipes(db, c.req.valid('query')));
    })
    .get('/:id', validate('param', IdParamSchema), (c) => {
      const recipe = getRecipe(db, c.req.valid('param').id);
      if (!recipe) throw recipeNotFound();
      return c.json(recipe);
    })
    .post('/', validate('json', RecipeInputSchema), (c) => {
      const input = c.req.valid('json');
      assertImageExists(input.imagePath);
      return c.json(createRecipe(db, input), 201);
    })
    .put(
      '/:id',
      validate('param', IdParamSchema),
      validate('json', RecipeInputSchema),
      async (c) => {
        const input = c.req.valid('json');
        assertImageExists(input.imagePath);
        const result = updateRecipe(db, c.req.valid('param').id, input);
        if (!result) throw recipeNotFound();

        const { recipe, previousImagePath } = result;
        if (previousImagePath && previousImagePath !== recipe.imagePath) {
          await images.remove(previousImagePath);
        }
        return c.json(recipe);
      },
    )
    .patch('/:id', validate('param', IdParamSchema), validate('json', RecipePatchSchema), (c) => {
      const recipe = patchRecipe(db, c.req.valid('param').id, c.req.valid('json'));
      if (!recipe) throw recipeNotFound();
      return c.json(recipe);
    })
    .delete('/:id', validate('param', IdParamSchema), async (c) => {
      const deleted = deleteRecipe(db, c.req.valid('param').id);
      if (!deleted) throw recipeNotFound();
      if (deleted.imagePath) await images.remove(deleted.imagePath);
      return c.body(null, 204);
    });
}
