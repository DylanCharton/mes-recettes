import { Hono } from 'hono';
import { z } from 'zod';
import {
  CookCreateSchema,
  RecipeInputSchema,
  RecipeListQuerySchema,
  RecipePatchSchema,
} from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { AppError, recipeNotFound } from '../lib/errors';
import { importerForSource } from '../importers/registry';
import { validate } from '../lib/validate';
import { addCook } from '../services/cooks';
import { downloadImage } from '../services/imports';
import {
  createRecipe,
  deleteRecipe,
  findDuplicate,
  getRecipe,
  isImageOwnedByOther,
  listRecipes,
  patchRecipe,
  updateRecipe,
} from '../services/recipes';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export function recipeRoutes(deps: AppDeps) {
  const { db, images } = deps;
  const assertImageUsable = (userId: number, imagePath: string | null | undefined) => {
    if (imagePath && (!images.exists(imagePath) || isImageOwnedByOther(db, userId, imagePath))) {
      throw new AppError('VALIDATION_ERROR', 400, 'Image introuvable, renvoyez-la');
    }
  };

  return new Hono()
    .get('/', validate('query', RecipeListQuerySchema), (c) => {
      return c.json(listRecipes(db, c.get('user').id, c.req.valid('query')));
    })
    .get('/:id', validate('param', IdParamSchema), (c) => {
      const recipe = getRecipe(db, c.get('user').id, c.req.valid('param').id);
      if (!recipe) throw recipeNotFound();
      return c.json(recipe);
    })
    .post('/', validate('json', RecipeInputSchema), async (c) => {
      const input = c.req.valid('json');
      const userId = c.get('user').id;
      assertImageUsable(userId, input.imagePath);

      const importer = input.source ? importerForSource(input.source) : undefined;
      if (importer && !input.force) {
        const existing = findDuplicate(
          db,
          userId,
          importer.source,
          input.externalId,
          input.sourceUrl,
        );
        if (existing) {
          throw new AppError('DUPLICATE_RECIPE', 409, 'Cette recette existe déjà', { existing });
        }
      }

      // Image distante téléchargée depuis les seuls hôtes de la source (jamais une URL arbitraire).
      let imagePath = input.imagePath ?? null;
      if (!imagePath && importer && input.imageSourceUrl) {
        imagePath = await downloadImage(deps, input.imageSourceUrl, importer.imageHosts);
      }

      const recipe = createRecipe(db, userId, { ...input, imagePath });
      deps.logger.info({ userId, recipeId: recipe.id, source: recipe.source }, 'recipe.created');
      return c.json(recipe, 201);
    })
    .put(
      '/:id',
      validate('param', IdParamSchema),
      validate('json', RecipeInputSchema),
      async (c) => {
        const input = c.req.valid('json');
        const userId = c.get('user').id;
        assertImageUsable(userId, input.imagePath);
        const result = updateRecipe(db, userId, c.req.valid('param').id, input);
        if (!result) throw recipeNotFound();

        const { recipe, previousImagePath } = result;
        if (previousImagePath && previousImagePath !== recipe.imagePath) {
          await images.remove(previousImagePath);
        }
        return c.json(recipe);
      },
    )
    .patch('/:id', validate('param', IdParamSchema), validate('json', RecipePatchSchema), (c) => {
      const recipe = patchRecipe(
        db,
        c.get('user').id,
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      if (!recipe) throw recipeNotFound();
      return c.json(recipe);
    })
    .post(
      '/:id/cooks',
      validate('param', IdParamSchema),
      validate('json', CookCreateSchema),
      (c) => {
        const { cookedAt } = c.req.valid('json');
        const date = cookedAt ? new Date(cookedAt) : new Date();
        // Une minute de marge pour une horloge de téléphone un peu en avance.
        if (date.getTime() > Date.now() + 60_000) {
          throw new AppError('VALIDATION_ERROR', 400, 'La date ne peut pas être dans le futur');
        }
        const entry = addCook(db, c.get('user').id, c.req.valid('param').id, date);
        if (!entry) throw recipeNotFound();
        return c.json(entry, 201);
      },
    )
    .delete('/:id', validate('param', IdParamSchema), async (c) => {
      const deleted = deleteRecipe(db, c.get('user').id, c.req.valid('param').id);
      if (!deleted) throw recipeNotFound();
      if (deleted.imagePath) await images.remove(deleted.imagePath);
      return c.body(null, 204);
    });
}
