import type { CookEntry, CookList, RecipeDetail } from '@mes-recettes/shared';
import { describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest } from './helpers';

type App = ReturnType<typeof createTestContext>['app'];

async function createRecipe(app: App, title: string) {
  const res = await app.request('/api/recipes', jsonRequest('POST', { title, servings: 2 }));
  expect(res.status).toBe(201);
  return (await res.json()) as RecipeDetail;
}

const cook = (app: App, recipeId: number, body: object = {}) =>
  app.request(`/api/recipes/${recipeId}/cooks`, jsonRequest('POST', body));

const timeline = async (app: App) =>
  ((await (await app.request('/api/cooks')).json()) as CookList).items;

describe('« Je l’ai faite ! » et frise', () => {
  it('enregistre une réalisation et l’ajoute à la fiche', async () => {
    const { app } = createTestContext();
    const recipe = await createRecipe(app, 'Curry');
    expect(recipe).toMatchObject({ cookCount: 0, lastCookedAt: null });

    const res = await cook(app, recipe.id);
    expect(res.status).toBe(201);
    const entry = (await res.json()) as CookEntry;
    expect(entry).toMatchObject({ recipeId: recipe.id, title: 'Curry', imageUrl: null });

    const detail = (await (await app.request(`/api/recipes/${recipe.id}`)).json()) as RecipeDetail;
    expect(detail).toMatchObject({ cookCount: 1, lastCookedAt: entry.cookedAt });
  });

  it('renvoie la frise dans l’ordre chronologique, dates passées comprises', async () => {
    const { app } = createTestContext();
    const curry = await createRecipe(app, 'Curry');
    const dahl = await createRecipe(app, 'Dahl');
    await cook(app, curry.id);
    await cook(app, dahl.id, { cookedAt: '2026-01-15T19:00:00+01:00' });

    const items = await timeline(app);
    expect(items.map((item) => item.title)).toEqual(['Dahl', 'Curry']);
    expect(items[0]!.cookedAt).toBe('2026-01-15T18:00:00.000Z');
  });

  it('refuse une date future et une recette inconnue', async () => {
    const { app } = createTestContext();
    const recipe = await createRecipe(app, 'Curry');
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect((await cook(app, recipe.id, { cookedAt: future })).status).toBe(400);
    expect((await cook(app, recipe.id, { cookedAt: 'hier' })).status).toBe(400);
    expect((await cook(app, 999)).status).toBe(404);
  });

  it('annule une réalisation, et efface celles d’une recette supprimée', async () => {
    const { app } = createTestContext();
    const curry = await createRecipe(app, 'Curry');
    const dahl = await createRecipe(app, 'Dahl');
    const entry = (await (await cook(app, curry.id)).json()) as CookEntry;
    await cook(app, dahl.id);

    expect((await app.request(`/api/cooks/${entry.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await app.request(`/api/cooks/${entry.id}`, { method: 'DELETE' })).status).toBe(404);
    await app.request(`/api/recipes/${dahl.id}`, { method: 'DELETE' });
    expect(await timeline(app)).toEqual([]);
  });
});
