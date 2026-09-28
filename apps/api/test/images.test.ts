import fs from 'node:fs';
import path from 'node:path';
import type { RecipeDetail } from '@mes-recettes/shared';
import { describe, expect, it } from 'vitest';
import { createTestContext, FAKE_JPEG, jsonRequest } from './helpers';

function upload(
  app: ReturnType<typeof createTestContext>['app'],
  bytes: Uint8Array,
  name = 'photo.jpg',
) {
  const form = new FormData();
  form.append('file', new File([bytes], name));
  return app.request('/api/images', { method: 'POST', body: form });
}

describe('API images', () => {
  it('enregistre une image reconnue et la sert avec un cache long', async () => {
    const { app } = createTestContext();
    const res = await upload(app, FAKE_JPEG);
    expect(res.status).toBe(201);
    const { imagePath } = (await res.json()) as { imagePath: string };
    expect(imagePath).toMatch(/^[a-f0-9-]{36}\.jpg$/);

    const served = await app.request(`/images/${imagePath}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    expect(served.headers.get('cache-control')).toContain('immutable');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(FAKE_JPEG);
  });

  it('refuse un fichier qui n’est pas une image, quel que soit son nom', async () => {
    const { app } = createTestContext();
    const res = await upload(app, new TextEncoder().encode('<script>alert(1)</script>'), 'x.jpg');
    expect(res.status).toBe(415);
  });

  it('refuse une image de plus de 5 Mo', async () => {
    const { app } = createTestContext();
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(FAKE_JPEG);
    expect((await upload(app, big)).status).toBe(413);
  });

  it('refuse les noms de fichiers arbitraires (traversée de chemin)', async () => {
    const { app } = createTestContext();
    expect((await app.request('/images/..%2F..%2Fapp.db')).status).toBe(404);
    expect((await app.request('/images/photo.jpg')).status).toBe(404);
  });

  it('supprime le fichier avec la recette et lors du remplacement de la photo', async () => {
    const { app, imagesDir } = createTestContext();
    const first = ((await (await upload(app, FAKE_JPEG)).json()) as { imagePath: string })
      .imagePath;
    const second = ((await (await upload(app, FAKE_JPEG)).json()) as { imagePath: string })
      .imagePath;

    const recipe = (await (
      await app.request(
        '/api/recipes',
        jsonRequest('POST', { title: 'Tarte', servings: 6, imagePath: first }),
      )
    ).json()) as RecipeDetail;
    expect(recipe.imageUrl).toBe(`/images/${first}`);

    await app.request(
      `/api/recipes/${recipe.id}`,
      jsonRequest('PUT', { title: 'Tarte', servings: 6, imagePath: second }),
    );
    expect(fs.existsSync(path.join(imagesDir, first))).toBe(false);

    await app.request(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
    expect(fs.existsSync(path.join(imagesDir, second))).toBe(false);
  });

  it('refuse une recette qui référence une image inexistante', async () => {
    const { app } = createTestContext();
    const res = await app.request(
      '/api/recipes',
      jsonRequest('POST', {
        title: 'Tarte',
        servings: 6,
        imagePath: '00000000-0000-0000-0000-000000000000.jpg',
      }),
    );
    expect(res.status).toBe(400);
  });
});
