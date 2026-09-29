import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AuthConfig } from '../src/env';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { createTestContext, jsonRequest } from './helpers';

let auth: AuthConfig;

beforeAll(async () => {
  auth = {
    enabled: true,
    passwordHash: await hashPassword('bon-mot-de-passe'),
    sessionSecret: 'x'.repeat(32),
    secureCookie: false,
  };
});

async function login(
  app: ReturnType<typeof createTestContext>['app'],
  password = 'bon-mot-de-passe',
) {
  return app.request('/api/auth/login', jsonRequest('POST', { password }));
}

describe('mot de passe', () => {
  it('vérifie une empreinte scrypt et refuse les empreintes invalides', async () => {
    const hash = await hashPassword('secret');
    expect(hash).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword('secret', hash)).toBe(true);
    expect(await verifyPassword('Secret', hash)).toBe(false);
    expect(await verifyPassword('secret', 'scrypt$abc')).toBe(false);
  });
});

describe('authentification (CA-F15)', () => {
  it('protège l’API et les images, mais pas la santé ni la connexion', async () => {
    const { app } = createTestContext({ auth });
    expect((await app.request('/api/recipes')).status).toBe(401);
    expect((await app.request('/api/tags')).status).toBe(401);
    expect((await app.request('/images/00000000-0000-0000-0000-000000000000.jpg')).status).toBe(
      401,
    );
    expect((await app.request('/api/health')).status).toBe(200);
    expect(await (await app.request('/api/auth/me')).json()).toEqual({
      authEnabled: true,
      authenticated: false,
    });
  });

  it('ouvre une session avec le bon mot de passe (cookie HttpOnly, SameSite=Lax)', async () => {
    const { app } = createTestContext({ auth });
    expect((await login(app, 'mauvais')).status).toBe(401);

    const res = await login(app);
    expect(res.status).toBe(204);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/mr_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const session = { headers: { cookie: cookie.split(';')[0]! } };
    expect((await app.request('/api/recipes', session)).status).toBe(200);
    expect(await (await app.request('/api/auth/me', session)).json()).toMatchObject({
      authenticated: true,
    });
  });

  it('refuse un cookie falsifié', async () => {
    const { app } = createTestContext({ auth });
    const res = await app.request('/api/recipes', {
      headers: { cookie: 'mr_session=v1.123.fausse-signature' },
    });
    expect(res.status).toBe(401);
  });

  it('limite les tentatives de connexion à 5 par minute', async () => {
    const { app } = createTestContext({ auth });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await login(app, 'mauvais')).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  }, 30_000); // scrypt : ~1 s par vérification, volontairement

  it('ne demande rien quand l’authentification est désactivée', async () => {
    const { app } = createTestContext({ auth: { enabled: false } });
    expect((await app.request('/api/recipes')).status).toBe(200);
    expect(await (await app.request('/api/auth/me')).json()).toEqual({
      authEnabled: false,
      authenticated: true,
    });
  });
});

describe('durcissement', () => {
  it('refuse un envoi de formulaire venant d’un autre site (CSRF)', async () => {
    const { app } = createTestContext();
    const form = new FormData();
    form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'x.jpg'));
    const res = await app.request('/api/images', {
      method: 'POST',
      body: form,
      headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });

  it('pose une CSP stricte et les en-têtes de sécurité', async () => {
    const { app } = createTestContext();
    const res = await app.request('/api/health');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://static.jow.fr');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('refuse un corps JSON de plus de 1 Mo', async () => {
    const { app } = createTestContext();
    const res = await app.request(
      '/api/recipes',
      jsonRequest('POST', { title: 'x', servings: 2, notes: 'a'.repeat(1_100_000) }),
    );
    expect(res.status).toBe(413);
  });
});

describe('service du front buildé', () => {
  it('sert les fichiers, retombe sur index.html pour les routes du SPA, sans sortir du dossier', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Mes recettes</title>');
    fs.writeFileSync(path.join(dist, 'assets', 'app-abc.js'), 'console.log(1)');
    const { app } = createTestContext({ webDist: dist });

    const asset = await app.request('/assets/app-abc.js');
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect(asset.headers.get('cache-control')).toContain('immutable');

    const route = await app.request('/recipes/12');
    expect(await route.text()).toContain('<title>Mes recettes</title>');
    expect(route.headers.get('cache-control')).toBe('no-cache');

    const traversal = await app.request('/..%2F..%2F..%2Fetc%2Fpasswd');
    expect(await traversal.text()).toContain('<title>Mes recettes</title>');

    expect((await app.request('/api/inconnue')).status).toBe(404);
    fs.rmSync(dist, { recursive: true, force: true });
  });
});
