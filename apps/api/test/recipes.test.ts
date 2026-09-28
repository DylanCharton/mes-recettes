import { eq } from 'drizzle-orm';
import type { RecipeDetail, RecipeInput, RecipeList } from '@mes-recettes/shared';
import { describe, expect, it } from 'vitest';
import { ingredients, recipeIngredients } from '../src/db/schema';
import { createTestContext, jsonRequest } from './helpers';

const curry: RecipeInput = {
  title: 'Poulet au curry',
  servings: 2,
  prepMinutes: 4,
  cookMinutes: 11,
  ingredients: [
    { text: '2 escalopes de poulet' },
    { text: '140 g de riz' },
    { text: '1/2 càc de curry' },
    { text: 'Sel, poivre' },
  ],
  steps: ['Cuire le riz.', 'Faire revenir le poulet.'],
  tools: ['Poêle'],
};

async function create(app: ReturnType<typeof createTestContext>['app'], input: RecipeInput) {
  const res = await app.request('/api/recipes', jsonRequest('POST', input));
  expect(res.status).toBe(201);
  return (await res.json()) as RecipeDetail;
}

describe('API recettes', () => {
  it('crée une recette avec ingrédients analysés, étapes et temps total calculé', async () => {
    const { app } = createTestContext();
    const recipe = await create(app, curry);

    expect(recipe).toMatchObject({
      title: 'Poulet au curry',
      servings: 2,
      totalMinutes: 15,
      status: 'to_try',
      isFavorite: false,
      source: 'manual',
      tools: ['Poêle'],
      imageUrl: null,
    });
    expect(
      recipe.ingredients.map(({ quantity, unit, name }) => ({ quantity, unit, name })),
    ).toEqual([
      { quantity: 2, unit: 'piece', name: 'escalopes de poulet' },
      { quantity: 140, unit: 'g', name: 'riz' },
      { quantity: 0.5, unit: 'tsp', name: 'curry' },
      { quantity: null, unit: null, name: 'Sel, poivre' },
    ]);
    expect(recipe.ingredients[1]?.originalText).toBe('140 g de riz');
    expect(recipe.steps.map((step) => step.text)).toEqual([
      'Cuire le riz.',
      'Faire revenir le poulet.',
    ]);
  });

  it('accepte une recette avec seulement un titre (CA-F5/F6)', async () => {
    const { app } = createTestContext();
    const recipe = await create(app, { title: 'Crêpes de mamie', servings: 4 });
    expect(recipe.ingredients).toEqual([]);
    expect(recipe.totalMinutes).toBeNull();
  });

  it('réutilise le même ingrédient canonique au singulier comme au pluriel', async () => {
    const { app, db } = createTestContext();
    await create(app, { title: 'A', servings: 2, ingredients: [{ text: '2 carottes' }] });
    await create(app, { title: 'B', servings: 2, ingredients: [{ text: '300 g de carotte' }] });

    const rows = db.select().from(ingredients).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Carottes', normalizedName: 'carotte' });
  });

  it('refuse un corps invalide avec le détail par champ', async () => {
    const { app } = createTestContext();
    const res = await app.request('/api/recipes', jsonRequest('POST', { title: '', servings: 0 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: { path: string }[] } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['title', 'servings']),
    );
  });

  it('liste les recettes les plus récentes en premier', async () => {
    const { app } = createTestContext();
    await create(app, { title: 'Première', servings: 2 });
    await create(app, { title: 'Seconde', servings: 2 });

    const res = await app.request('/api/recipes');
    const list = (await res.json()) as RecipeList;
    expect(list.total).toBe(2);
    expect(list.items.map((item) => item.title)).toEqual(['Seconde', 'Première']);
  });

  it('renvoie 404 pour une recette inexistante', async () => {
    const { app } = createTestContext();
    expect((await app.request('/api/recipes/999')).status).toBe(404);
    expect((await app.request('/api/recipes/abc')).status).toBe(400);
  });

  it('conserve les données structurées des lignes inchangées lors d’une modification', async () => {
    const { app, db } = createTestContext();
    const recipe = await create(app, curry);

    // Simule une ligne importée plus riche que le parseur (placard, quantité exacte).
    const rice = recipe.ingredients[1]!;
    db.update(recipeIngredients)
      .set({ isPantry: true, quantity: 142 })
      .where(eq(recipeIngredients.id, rice.id))
      .run();

    const res = await app.request(
      `/api/recipes/${recipe.id}`,
      jsonRequest('PUT', {
        ...curry,
        title: 'Poulet au curry express',
        ingredients: [{ text: '140 g de riz' }, { text: '3 escalopes de poulet' }],
      }),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as RecipeDetail;

    expect(updated.title).toBe('Poulet au curry express');
    expect(updated.ingredients[0]).toMatchObject({
      originalText: '140 g de riz',
      quantity: 142,
      isPantry: true,
    });
    expect(updated.ingredients[1]).toMatchObject({
      originalText: '3 escalopes de poulet',
      quantity: 3,
      isPantry: false,
    });
  });

  it('modifie rapidement statut, favori et notes', async () => {
    const { app } = createTestContext();
    const recipe = await create(app, curry);
    const res = await app.request(
      `/api/recipes/${recipe.id}`,
      jsonRequest('PATCH', { status: 'validated', isFavorite: true, notes: 'Doubler le curry' }),
    );
    expect(await res.json()).toMatchObject({
      status: 'validated',
      isFavorite: true,
      notes: 'Doubler le curry',
      title: 'Poulet au curry',
    });
  });

  it('supprime la recette et ses lignes en cascade', async () => {
    const { app, db } = createTestContext();
    const recipe = await create(app, curry);

    const res = await app.request(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect((await app.request(`/api/recipes/${recipe.id}`)).status).toBe(404);
    expect(db.select().from(recipeIngredients).all()).toEqual([]);
  });
});
