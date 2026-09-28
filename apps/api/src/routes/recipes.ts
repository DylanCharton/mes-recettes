import { Hono } from 'hono';
import { z } from 'zod';
import { RecipeInputSchema, RecipeListQuerySchema, RecipePatchSchema } from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { AppError, recipeNotFound } from '../lib/errors';
import { importerForSource } from '../importers/registry';
import { validate } from '../lib/validate';
import { downloadImage } from '../services/imports';
import {
  createRecipe,
  deleteRecipe,
  findDuplicate,
  getRecipe,
  listRecipes,
  patchRecipe,
  updateRecipe,
} from '../services/recipes';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export function recipeRoutes(deps: AppDeps) {
  const { db, images } = deps;
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
    .post('/', validate('json', RecipeInputSchema), async (c) => {
      const input = c.req.valid('json');
      assertImageExists(input.imagePath);

      const importer = input.source ? importerForSource(input.source) : undefined;
      if (importer && !input.force) {
        const existing = findDuplicate(db, importer.source, input.externalId, input.sourceUrl);
        if (existing) {
          throw new AppError('DUPLICATE_RECIPE', 409, 'Cette recette existe déjà', { existing });
        }
      }

      // Image distante téléchargée depuis les seuls hôtes de la source (jamais une URL arbitraire).
      let imagePath = input.imagePath ?? null;
      if (!imagePath && importer && input.imageSourceUrl) {
        imagePath = await downloadImage(deps, input.imageSourceUrl, importer.imageHosts);
      }

      const recipe = createRecipe(db, { ...input, imagePath });
      deps.logger.info({ recipeId: recipe.id, source: recipe.source }, 'recipe.created');
      return c.json(recipe, 201);
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
