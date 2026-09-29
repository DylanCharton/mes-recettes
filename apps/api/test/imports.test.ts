import fs from 'node:fs';
import path from 'node:path';
import type { ImportPreviewResponse, RecipeDetail, RecipeDraft } from '@mes-recettes/shared';
import { describe, expect, it, vi } from 'vitest';
import type { FetchFn } from '../src/lib/safeFetch';
import { extractUrl } from '@mes-recettes/shared';
import { createTestContext, FAKE_JPEG, jsonRequest } from './helpers';

const CURRY_URL = 'https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5';
const curryHtml = fs.readFileSync(
  path.join(import.meta.dirname, 'fixtures/jow/poulet-au-curry-89y06dxjhfua0twu16x5.html'),
);

/** Simule jow.fr (page du curry) et static.jow.fr (image). */
function fakeJow(options: { imageStatus?: number } = {}) {
  return vi.fn<FetchFn>(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'jow.fr') {
      return new Response(curryHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url.hostname === 'static.jow.fr') {
      return new Response(FAKE_JPEG, {
        status: options.imageStatus ?? 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    }
    throw new Error(`hôte inattendu ${url.hostname}`);
  });
}

async function preview(app: ReturnType<typeof createTestContext>['app'], body: object) {
  const res = await app.request('/api/imports/preview', jsonRequest('POST', body));
  return {
    status: res.status,
    body: (await res.json()) as ImportPreviewResponse & { error?: { code: string } },
  };
}

async function previewDraft(
  app: ReturnType<typeof createTestContext>['app'],
): Promise<RecipeDraft> {
  const { body } = await preview(app, { url: CURRY_URL });
  if (body.status !== 'ok') throw new Error('aperçu attendu');
  return body.draft;
}

describe('extractUrl', () => {
  it('extrait la première URL d’un texte partagé', () => {
    expect(extractUrl(`Découvre cette recette sur Jow ! ${CURRY_URL}.`)).toBe(CURRY_URL);
    expect(extractUrl('pas de lien ici')).toBeNull();
  });
});

describe('POST /api/imports/preview', () => {
  it('renvoie un brouillon sans rien enregistrer (CA-F1)', async () => {
    const fetch = fakeJow();
    const { app } = createTestContext({ fetch });

    const { status, body } = await preview(app, { url: CURRY_URL });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      provider: 'jow',
      strategies: ['json_ld', 'next_data'],
      draft: { title: 'Poulet au curry', externalId: '89y06dxjhfua0twu16x5' },
    });

    const list = await (await app.request('/api/recipes')).json();
    expect(list).toMatchObject({ total: 0 });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(CURRY_URL);
  });

  it('accepte un texte partagé contenant le lien (CA-F1)', async () => {
    const { app } = createTestContext({ fetch: fakeJow() });
    const { body } = await preview(app, { text: `Découvre cette recette sur Jow ! ${CURRY_URL}` });
    expect(body.status).toBe('ok');
  });

  it('refuse un autre site sans aucune requête sortante (CA-F1)', async () => {
    const fetch = fakeJow();
    const { app } = createTestContext({ fetch });
    const { status, body } = await preview(app, {
      url: 'https://www.marmiton.org/recettes/x.aspx',
    });
    expect(status).toBe(422);
    expect(body.error?.code).toBe('UNSUPPORTED_URL');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('détecte un doublon avant tout appel à Jow, y compris via une autre URL (CA-F12)', async () => {
    const fetch = fakeJow();
    const { app } = createTestContext({ fetch });
    const draft = await previewDraft(app);
    await app.request('/api/recipes', jsonRequest('POST', draft));
    fetch.mockClear();

    const { body } = await preview(app, { url: 'https://jow.fr/recipes/89y06dxjhfua0twu16x5' });
    expect(body).toMatchObject({ status: 'duplicate', existing: { title: 'Poulet au curry' } });
    expect(fetch).not.toHaveBeenCalled();

    const forced = await preview(app, { url: CURRY_URL, force: true });
    expect(forced.body.status).toBe('ok');
  });

  it('suit le lien de partage de l’app Jow jusqu’à la fiche jow.fr, sans appeler app.jow.com', async () => {
    const shareId = '69f86dad46828277dd71568b';
    const fetch = vi.fn<FetchFn>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === `/fr/recipes/${shareId}`) {
        return new Response(null, {
          status: 308,
          headers: { location: '/recipes/poulet-au-curry-89y06dxjhfua0twu16x5' },
        });
      }
      return fakeJow()(input);
    });
    const { app } = createTestContext({ fetch });
    const share = `Regarde cette recette ! https://app.jow.com/EC0U?action=recipe&recipeId=${shareId}&source=jow`;

    const { body } = await preview(app, { text: share });
    expect(body).toMatchObject({
      status: 'ok',
      draft: { title: 'Poulet au curry', externalId: '89y06dxjhfua0twu16x5' },
    });
    expect(fetch.mock.calls.map(([u]) => new URL(String(u)).hostname)).toEqual([
      'jow.fr',
      'jow.fr',
    ]);

    // Doublon : détecté une fois la fiche téléchargée (l'identifiant de partage diffère).
    if (body.status !== 'ok') throw new Error('aperçu attendu');
    await app.request('/api/recipes', jsonRequest('POST', body.draft));
    const again = await preview(app, { text: share });
    expect(again.body).toMatchObject({
      status: 'duplicate',
      existing: { title: 'Poulet au curry' },
    });
    expect((await preview(app, { text: share, force: true })).body.status).toBe('ok');
  });

  it.each([
    ['https://jow.com/recipes/cobb-salad-8ohwfou4ilkid6l901ss', 'Jow US'],
    ['https://app.jow.com/', 'ne mène pas à une recette'],
  ])('explique pourquoi %s est refusé', async (url, message) => {
    const fetch = fakeJow();
    const { app } = createTestContext({ fetch });
    const { status, body } = await preview(app, { url });
    expect(status).toBe(422);
    expect((body.error as { message: string } | undefined)?.message).toContain(message);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('limite le nombre d’imports par minute', async () => {
    const { app } = createTestContext({ fetch: fakeJow() });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await preview(app, { url: CURRY_URL })).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('POST /api/recipes depuis un brouillon', () => {
  it('enregistre la recette avec ses données structurées et télécharge l’image (CA-F13)', async () => {
    const { app, imagesDir } = createTestContext({ fetch: fakeJow() });
    const draft = await previewDraft(app);

    const res = await app.request('/api/recipes', jsonRequest('POST', draft));
    expect(res.status).toBe(201);
    const recipe = (await res.json()) as RecipeDetail;

    expect(recipe).toMatchObject({
      source: 'jow',
      externalId: '89y06dxjhfua0twu16x5',
      sourceUrl: 'https://jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
      nutriScore: 'A',
      greenScore: 'C',
      difficulty: 1,
      status: 'to_try',
    });
    expect(recipe.importedAt).not.toBeNull();
    expect(recipe.imageUrl).toMatch(/^\/images\/[a-f0-9-]{36}\.jpg$/);
    expect(fs.readdirSync(imagesDir)).toHaveLength(1);

    const pantry = recipe.ingredients.find((line) => line.isPantry);
    expect(pantry).toMatchObject({ name: "Huile d'olive", quantity: 1, unit: 'tsp' });
    const rice = recipe.ingredients.find((line) => line.name === 'Riz');
    expect(rice).toMatchObject({ quantity: 70, unit: 'g', originalText: '70 g Riz' });
  });

  it('enregistre quand même la recette si l’image est indisponible (CA-F13)', async () => {
    const { app } = createTestContext({ fetch: fakeJow({ imageStatus: 404 }) });
    const draft = await previewDraft(app);
    const recipe = (await (
      await app.request('/api/recipes', jsonRequest('POST', draft))
    ).json()) as RecipeDetail;
    expect(recipe.imagePath).toBeNull();
    expect(recipe.imageUrl).toBe('https://static.jow.fr/1024x768/recipes/gR0kkvSrtRIyvQ.jpg');
  });

  it('refuse un doublon (409) sauf « Importer quand même » (CA-F12)', async () => {
    const { app } = createTestContext({ fetch: fakeJow() });
    const draft = await previewDraft(app);
    await app.request('/api/recipes', jsonRequest('POST', draft));

    const duplicate = await app.request('/api/recipes', jsonRequest('POST', draft));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      error: { code: 'DUPLICATE_RECIPE', details: { existing: { title: 'Poulet au curry' } } },
    });

    const forced = await app.request(
      '/api/recipes',
      jsonRequest('POST', { ...draft, force: true }),
    );
    expect(forced.status).toBe(201);
  });

  it('ne télécharge jamais une image hors des hôtes de la source', async () => {
    const fetch = fakeJow();
    const { app } = createTestContext({ fetch });
    const draft = await previewDraft(app);
    fetch.mockClear();

    const recipe = (await (
      await app.request(
        '/api/recipes',
        jsonRequest('POST', { ...draft, imageSourceUrl: 'https://evil.com/x.jpg' }),
      )
    ).json()) as RecipeDetail;
    expect(fetch).not.toHaveBeenCalled();
    expect(recipe.imagePath).toBeNull();
  });

  it('conserve difficulté et nutrition quand le formulaire modifie la recette', async () => {
    const { app } = createTestContext({ fetch: fakeJow() });
    const draft = await previewDraft(app);
    const created = (await (
      await app.request('/api/recipes', jsonRequest('POST', draft))
    ).json()) as RecipeDetail;

    const updated = (await (
      await app.request(
        `/api/recipes/${created.id}`,
        jsonRequest('PUT', {
          title: 'Mon curry',
          servings: 1,
          ingredients: created.ingredients.map((line) => ({ text: line.originalText })),
          steps: created.steps.map((step) => step.text),
        }),
      )
    ).json()) as RecipeDetail;

    expect(updated).toMatchObject({
      title: 'Mon curry',
      difficulty: 1,
      nutriScore: 'A',
      source: 'jow',
    });
    expect(updated.ingredients.find((line) => line.isPantry)?.name).toBe("Huile d'olive");
  });
});
