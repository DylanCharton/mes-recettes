import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';

describe('GET /api/health', () => {
  it('répond ok avec la version', async () => {
    const res = await createTestApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: expect.any(String) });
  });

  it('renvoie une erreur JSON 404 sur une route inconnue', async () => {
    const res = await createTestApp().request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Ressource introuvable' },
    });
  });
});
