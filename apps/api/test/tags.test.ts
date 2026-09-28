import type { RecipeDetail, RecipeInput, Tag } from '@mes-recettes/shared';
import { describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest } from './helpers';

type App = ReturnType<typeof createTestContext>['app'];

async function createRecipe(app: App, input: Partial<RecipeInput> & { title: string }) {
  const res = await app.request('/api/recipes', jsonRequest('POST', { servings: 2, ...input }));
  expect(res.status).toBe(201);
  return (await res.json()) as RecipeDetail;
}

const listTags = async (app: App) => (await (await app.request('/api/tags')).json()) as Tag[];

describe('tags sur les recettes', () => {
  it('crée les tags à la volée et les réutilise sans tenir compte de la casse ni des accents', async () => {
    const { app } = createTestContext();
    const a = await createRecipe(app, { title: 'Curry', tags: ['Végétarien', 'rapide'] });
    const b = await createRecipe(app, { title: 'Dahl', tags: ['vegetarien'] });

    expect(a.tags.map((t) => t.name)).toEqual(['rapide', 'Végétarien']);
    expect(b.tags).toEqual([a.tags.find((t) => t.name === 'Végétarien')]);
    expect(await listTags(app)).toMatchObject([
      { name: 'rapide', recipeCount: 1 },
      { name: 'Végétarien', recipeCount: 2 },
    ]);
  });

  it('remplace les tags à la modification, et les conserve si le champ est absent', async () => {
    const { app } = createTestContext();
    const recipe = await createRecipe(app, { title: 'Curry', tags: ['indien'] });

    const put = async (body: object) =>
      (await (
        await app.request(
          `/api/recipes/${recipe.id}`,
          jsonRequest('PUT', { title: 'Curry', servings: 2, ...body }),
        )
      ).json()) as RecipeDetail;

    expect((await put({ tags: ['rapide'] })).tags.map((t) => t.name)).toEqual(['rapide']);
    expect((await put({})).tags.map((t) => t.name)).toEqual(['rapide']);
  });
});

describe('API /api/tags (CA-F8)', () => {
  it('refuse un doublon de nom normalisé', async () => {
    const { app } = createTestContext();
    await app.request('/api/tags', jsonRequest('POST', { name: 'vegetarien' }));
    const res = await app.request('/api/tags', jsonRequest('POST', { name: 'Végétarien' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: 'TAG_EXISTS', details: { existing: { name: 'vegetarien' } } },
    });
  });

  it('renomme un tag pour toutes les recettes', async () => {
    const { app } = createTestContext();
    const recipe = await createRecipe(app, { title: 'Curry', tags: ['veggie'] });
    const [tag] = await listTags(app);

    const res = await app.request(
      `/api/tags/${tag!.id}`,
      jsonRequest('PATCH', { name: 'Végétarien' }),
    );
    expect(res.status).toBe(200);
    const updated = (await (await app.request(`/api/recipes/${recipe.id}`)).json()) as RecipeDetail;
    expect(updated.tags.map((t) => t.name)).toEqual(['Végétarien']);
  });

  it('propose puis réalise la fusion quand le nouveau nom existe déjà', async () => {
    const { app } = createTestContext();
    const a = await createRecipe(app, { title: 'A', tags: ['veggie'] });
    const b = await createRecipe(app, { title: 'B', tags: ['végétarien', 'veggie'] });
    const veggie = (await listTags(app)).find((t) => t.name === 'veggie')!;

    const refused = await app.request(
      `/api/tags/${veggie.id}`,
      jsonRequest('PATCH', { name: 'Végétarien' }),
    );
    expect(refused.status).toBe(409);

    const merged = await app.request(
      `/api/tags/${veggie.id}`,
      jsonRequest('PATCH', { name: 'Végétarien', merge: true }),
    );
    expect(merged.status).toBe(200);
    expect(await listTags(app)).toMatchObject([{ name: 'végétarien', recipeCount: 2 }]);

    for (const id of [a.id, b.id]) {
      const recipe = (await (await app.request(`/api/recipes/${id}`)).json()) as RecipeDetail;
      expect(recipe.tags.map((t) => t.name)).toEqual(['végétarien']);
    }
  });

  it('supprime un tag sans supprimer les recettes', async () => {
    const { app } = createTestContext();
    const recipe = await createRecipe(app, { title: 'Curry', tags: ['indien'] });
    const [tag] = await listTags(app);

    expect((await app.request(`/api/tags/${tag!.id}`, { method: 'DELETE' })).status).toBe(204);
    const kept = (await (await app.request(`/api/recipes/${recipe.id}`)).json()) as RecipeDetail;
    expect(kept.tags).toEqual([]);
  });
});

describe('saisons (CA-F8b)', () => {
  it('enregistre 0 à 4 saisons, dans l’ordre de l’année, et les modifie par PATCH', async () => {
    const { app } = createTestContext();
    const none = await createRecipe(app, { title: 'Sans saison' });
    expect(none.seasons).toEqual([]);

    const recipe = await createRecipe(app, { title: 'Potimarron', seasons: ['winter', 'autumn'] });
    expect(recipe.seasons).toEqual(['autumn', 'winter']);

    const patched = (await (
      await app.request(
        `/api/recipes/${recipe.id}`,
        jsonRequest('PATCH', { seasons: ['spring', 'summer', 'autumn', 'winter'] }),
      )
    ).json()) as RecipeDetail;
    expect(patched.seasons).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });

  it('refuse une saison inconnue', async () => {
    const { app } = createTestContext();
    const res = await app.request(
      '/api/recipes',
      jsonRequest('POST', { title: 'X', servings: 2, seasons: ['mousson'] }),
    );
    expect(res.status).toBe(400);
  });
});
