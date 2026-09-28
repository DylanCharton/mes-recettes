import type { RecipeDetail, RecipeInput, RecipeList, Tag } from '@mes-recettes/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest } from './helpers';

type App = ReturnType<typeof createTestContext>['app'];

let app: App;
const ids: Record<string, number> = {};

async function seed(input: Partial<RecipeInput> & { title: string }) {
  const res = await app.request('/api/recipes', jsonRequest('POST', { servings: 2, ...input }));
  const recipe = (await res.json()) as RecipeDetail;
  ids[recipe.title] = recipe.id;
  return recipe;
}

async function titles(query: string): Promise<string[]> {
  const res = await app.request(`/api/recipes?${query}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as RecipeList).items.map((item) => item.title).sort();
}

beforeEach(async () => {
  app = createTestContext().app;
  await seed({
    title: 'Poulet au curry',
    totalMinutes: 15,
    ingredients: [{ text: '2 escalopes de poulet' }, { text: '20 cl de crème fraîche' }],
    tags: ['indien', 'rapide'],
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    isFavorite: true,
  });
  await seed({
    title: 'Poulet rôti au potimarron',
    totalMinutes: 90,
    ingredients: [{ text: '1 poulet entier' }, { text: '1 potimarron' }],
    tags: ['dimanche'],
    seasons: ['autumn', 'winter'],
  });
  await seed({
    title: 'Salade de tomates',
    totalMinutes: 10,
    ingredients: [{ text: '4 tomates' }],
    tags: ['rapide', 'végétarien'],
    seasons: ['summer'],
    status: 'validated',
  });
  await seed({ title: 'Gratin 100% fromage', ingredients: [{ text: '200 g de comté' }] });
  await seed({ title: 'Vieille recette', status: 'archived', tags: ['rapide'] });
});

describe('GET /api/recipes — filtres (CA-F3, CA-F8b)', () => {
  it('masque les recettes archivées par défaut', async () => {
    expect(await titles('')).not.toContain('Vieille recette');
    expect(await titles('status=archived')).toEqual(['Vieille recette']);
  });

  it('cherche dans le titre et les ingrédients, sans accents ni casse', async () => {
    expect(await titles('q=poulet')).toEqual(['Poulet au curry', 'Poulet rôti au potimarron']);
    expect(await titles('q=CREME')).toEqual(['Poulet au curry']);
    expect(await titles('q=roti poulet')).toEqual(['Poulet rôti au potimarron']);
  });

  it('cherche aussi dans les tags', async () => {
    expect(await titles('q=vegetarien')).toEqual(['Salade de tomates']);
  });

  it('échappe les caractères spéciaux de LIKE', async () => {
    expect(await titles('q=100%25')).toEqual(['Gratin 100% fromage']);
    expect(await titles('q=_')).toEqual([]);
  });

  it('exige tous les tags sélectionnés (ET)', async () => {
    const tags = (await (await app.request('/api/tags')).json()) as Tag[];
    const id = (name: string) => tags.find((tag) => tag.name === name)!.id;
    expect(await titles(`tags=${id('rapide')}`)).toEqual(['Poulet au curry', 'Salade de tomates']);
    expect(await titles(`tags=${id('rapide')},${id('indien')}`)).toEqual(['Poulet au curry']);
  });

  it('filtre les saisons en OU, strictement, « toute l’année » comprise', async () => {
    expect(await titles('seasons=winter')).toEqual([
      'Poulet au curry',
      'Poulet rôti au potimarron',
    ]);
    expect(await titles('seasons=summer,spring')).toEqual(['Poulet au curry', 'Salade de tomates']);
    expect(await titles('seasons=autumn')).not.toContain('Gratin 100% fromage');
  });

  it('filtre par temps maximal, favoris, statut et source', async () => {
    expect(await titles('maxTime=30')).toEqual(['Poulet au curry', 'Salade de tomates']);
    expect(await titles('favorite=1')).toEqual(['Poulet au curry']);
    expect(await titles('status=validated')).toEqual(['Salade de tomates']);
    expect(await titles('source=jow')).toEqual([]);
  });

  it('filtre par ingrédient canonique (« poulets » trouve les deux poulets)', async () => {
    expect(await titles('ingredient=poulets')).toEqual([
      'Poulet au curry',
      'Poulet rôti au potimarron',
    ]);
    expect(await titles('ingredient=tomate')).toEqual(['Salade de tomates']);
  });

  it('combine les familles de filtres (ET)', async () => {
    expect(await titles('q=poulet&maxTime=30&seasons=winter&favorite=1')).toEqual([
      'Poulet au curry',
    ]);
    expect(await titles('q=poulet&seasons=summer&maxTime=60')).toEqual(['Poulet au curry']);
  });

  it('trie par titre ou par temps, et renvoie le total filtré et les tags des cartes', async () => {
    const res = await app.request('/api/recipes?sort=time&maxTime=60');
    const list = (await res.json()) as RecipeList;
    expect(list.total).toBe(2);
    expect(list.items.map((item) => item.title)).toEqual(['Salade de tomates', 'Poulet au curry']);
    expect(list.items[1]?.tags.map((tag) => tag.name)).toEqual(['indien', 'rapide']);

    await seed({ title: 'Pâtes au pesto' });
    const byTitle = (await (await app.request('/api/recipes?sort=title')).json()) as RecipeList;
    // Tri insensible aux accents : « Pâtes » entre « Gratin » et « Poulet ».
    expect(byTitle.items.map((item) => item.title)).toEqual([
      'Gratin 100% fromage',
      'Pâtes au pesto',
      'Poulet au curry',
      'Poulet rôti au potimarron',
      'Salade de tomates',
    ]);
  });

  it('refuse un filtre invalide', async () => {
    expect((await app.request('/api/recipes?seasons=mousson')).status).toBe(400);
    expect((await app.request('/api/recipes?sort=hasard')).status).toBe(400);
  });
});

describe('GET /api/ingredients', () => {
  it('propose les ingrédients utilisés, les plus fréquents d’abord', async () => {
    const res = await app.request('/api/ingredients?q=poul');
    const found = (await res.json()) as { name: string; recipeCount: number }[];
    expect(found.map((item) => item.name)).toEqual(
      expect.arrayContaining(['Escalopes de poulet', 'Poulet entier']),
    );
    const po = (await (await app.request('/api/ingredients?q=po')).json()) as { name: string }[];
    expect(po[0]?.name).toMatch(/^Po/);
  });
});
