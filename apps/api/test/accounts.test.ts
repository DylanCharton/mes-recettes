import { eq } from 'drizzle-orm';
import type { CreatedInvitation, RecipeDetail, RecipeList, Tag } from '@mes-recettes/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { invitations, users } from '../src/db/schema';
import type { AuthConfig } from '../src/env';
import { hashPassword } from '../src/lib/password';
import { bootstrapAdmin } from '../src/services/users';
import { createTestContext, FAKE_JPEG, jsonRequest, sessionHeaders, withSession } from './helpers';

const auth: AuthConfig = { enabled: true, sessionSecret: 'x'.repeat(32), secureCookie: false };
const ADMIN = { email: 'admin@example.fr', password: 'mot-de-passe-admin' };
const FRIEND = { name: 'Camille', email: 'camille@example.fr', password: 'mot-de-passe-ami' };
let adminHash: string;

beforeAll(async () => {
  adminHash = await hashPassword(ADMIN.password);
});

type App = ReturnType<typeof createTestContext>['app'];

/** Application avec authentification, administrateur connecté. */
async function setup() {
  const context = createTestContext({ auth });
  bootstrapAdmin(context.db, { email: ADMIN.email, passwordHash: adminHash });
  const res = await context.app.request('/api/auth/login', jsonRequest('POST', ADMIN));
  expect(res.status).toBe(204);
  return { ...context, admin: sessionHeaders(res) };
}

async function invite(app: App, admin: RequestInit): Promise<string> {
  const res = await app.request('/api/invitations', withSession({ method: 'POST' }, admin));
  expect(res.status).toBe(201);
  return ((await res.json()) as CreatedInvitation).token;
}

async function accept(app: App, token: string, body: object = FRIEND) {
  return app.request(`/api/auth/invitations/${token}/accept`, jsonRequest('POST', body));
}

/** Invitation acceptée : session du nouveau compte. */
async function createFriend(app: App, admin: RequestInit): Promise<RequestInit> {
  const res = await accept(app, await invite(app, admin));
  expect(res.status).toBe(201);
  return sessionHeaders(res);
}

async function createRecipe(app: App, session: RequestInit, body: object) {
  const res = await app.request(
    '/api/recipes',
    withSession(
      jsonRequest('POST', { servings: 2, ingredients: [{ text: '200 g de riz' }], ...body }),
      session,
    ),
  );
  return res;
}

describe('invitations (§ 18.4)', () => {
  it('crée un compte depuis un lien à usage unique, connecté d’emblée', async () => {
    const { app, admin } = await setup();
    const token = await invite(app, admin);

    expect(await (await app.request(`/api/auth/invitations/${token}`)).json()).toEqual({
      invitedBy: 'dylan',
    });

    const res = await accept(app, token, { ...FRIEND, email: ' Camille@Example.FR ' });
    expect(res.status).toBe(201);
    expect(await (await app.request('/api/auth/me', sessionHeaders(res))).json()).toMatchObject({
      authenticated: true,
      user: { name: 'Camille', email: 'camille@example.fr', isAdmin: false },
    });

    // Usage unique, et l'invitation disparaît de la liste.
    expect((await accept(app, token, { ...FRIEND, email: 'autre@example.fr' })).status).toBe(404);
    expect(await (await app.request('/api/invitations', admin)).json()).toEqual([]);

    // Le nouveau compte se connecte ensuite par e-mail.
    const login = await app.request(
      '/api/auth/login',
      jsonRequest('POST', { email: FRIEND.email, password: FRIEND.password }),
    );
    expect(login.status).toBe(204);
  }, 30_000);

  it('refuse un jeton inconnu, expiré ou révoqué', async () => {
    const { app, admin, db } = await setup();
    expect((await app.request(`/api/auth/invitations/${'a'.repeat(32)}`)).status).toBe(404);

    const expired = await invite(app, admin);
    db.update(invitations).set({ expiresAt: '2000-01-01T00:00:00.000Z' }).run();
    expect((await app.request(`/api/auth/invitations/${expired}`)).status).toBe(404);

    const revoked = await invite(app, admin);
    const [pending] = (await (await app.request('/api/invitations', admin)).json()) as {
      id: number;
    }[];
    const del = await app.request(`/api/invitations/${pending!.id}`, {
      ...admin,
      method: 'DELETE',
    });
    expect(del.status).toBe(204);
    const res = await accept(app, revoked);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'INVITATION_INVALID' } });
  });

  it('refuse un e-mail déjà utilisé et un mot de passe trop court', async () => {
    const { app, admin } = await setup();
    const token = await invite(app, admin);
    const taken = await accept(app, token, { ...FRIEND, email: ADMIN.email });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ error: { code: 'EMAIL_TAKEN' } });
    expect((await accept(app, token, { ...FRIEND, password: 'court' })).status).toBe(400);
  }, 30_000);

  it('réserve les invitations à l’administrateur', async () => {
    const { app, admin } = await setup();
    const friend = await createFriend(app, admin);
    expect((await app.request('/api/invitations', friend)).status).toBe(403);
    expect(
      (await app.request('/api/invitations', withSession({ method: 'POST' }, friend))).status,
    ).toBe(403);
  }, 30_000);
});

describe('isolation des bibliothèques', () => {
  it('ne montre ni ne modifie les recettes, tags et ingrédients d’un autre compte', async () => {
    const { app, admin } = await setup();
    const mine = (await (
      await createRecipe(app, admin, { title: 'Risotto', tags: ['Rapide'] })
    ).json()) as RecipeDetail;
    const friend = await createFriend(app, admin);

    const list = (await (await app.request('/api/recipes', friend)).json()) as RecipeList;
    expect(list.total).toBe(0);
    expect(await (await app.request('/api/tags', friend)).json()).toEqual([]);
    expect(await (await app.request('/api/ingredients?q=riz', friend)).json()).toEqual([]);

    const url = `/api/recipes/${mine.id}`;
    expect((await app.request(url, friend)).status).toBe(404);
    expect(
      (await app.request(url, withSession(jsonRequest('PATCH', { isFavorite: true }), friend)))
        .status,
    ).toBe(404);
    expect(
      (
        await app.request(
          url,
          withSession(jsonRequest('PUT', { title: 'Volé', servings: 2, ingredients: [] }), friend),
        )
      ).status,
    ).toBe(404);
    expect((await app.request(url, { ...friend, method: 'DELETE' })).status).toBe(404);

    const tagId = mine.tags[0]!.id;
    expect(
      (
        await app.request(
          `/api/tags/${tagId}`,
          withSession(jsonRequest('PATCH', { name: 'X' }), friend),
        )
      ).status,
    ).toBe(404);
    expect((await app.request(`/api/tags/${tagId}`, { ...friend, method: 'DELETE' })).status).toBe(
      404,
    );
    // Filtrer sur le tag d'un autre compte ne révèle rien.
    const filtered = (await (
      await app.request(`/api/recipes?tags=${tagId}`, friend)
    ).json()) as RecipeList;
    expect(filtered.total).toBe(0);

    // Ma recette est intacte.
    const after = (await (await app.request(url, admin)).json()) as RecipeDetail;
    expect(after).toMatchObject({ title: 'Risotto', isFavorite: false });
    expect(after.tags.map((tag) => tag.name)).toEqual(['Rapide']);
  }, 30_000);

  it('donne à chaque compte ses propres tags et sa propre détection de doublons', async () => {
    const { app, admin } = await setup();
    const jow = { title: 'Curry', source: 'jow', externalId: 'abc123', tags: ['Rapide'] };
    expect((await createRecipe(app, admin, jow)).status).toBe(201);
    expect((await createRecipe(app, admin, jow)).status).toBe(409);

    const friend = await createFriend(app, admin);
    const res = await createRecipe(app, friend, jow);
    expect(res.status).toBe(201);
    const theirs = (await res.json()) as RecipeDetail;

    const tags = (await (await app.request('/api/tags', friend)).json()) as Tag[];
    expect(tags).toEqual([{ id: theirs.tags[0]!.id, name: 'Rapide', recipeCount: 1 }]);
    const mine = (await (await app.request('/api/tags', admin)).json()) as Tag[];
    expect(mine[0]!.id).not.toBe(tags[0]!.id);
  }, 30_000);

  it('refuse de reprendre l’image d’une recette d’un autre compte', async () => {
    const { app, admin, images } = await setup();
    const imagePath = (await images.save(FAKE_JPEG))!;
    expect((await createRecipe(app, admin, { title: 'Tarte', imagePath })).status).toBe(201);

    const friend = await createFriend(app, admin);
    const res = await createRecipe(app, friend, { title: 'Copie', imagePath });
    expect(res.status).toBe(400);
  }, 30_000);
});

describe('mot de passe', () => {
  it('change le mot de passe et déconnecte les autres appareils', async () => {
    const { app, admin } = await setup();
    const phone = await createFriend(app, admin);
    const login = await app.request(
      '/api/auth/login',
      jsonRequest('POST', { email: FRIEND.email, password: FRIEND.password }),
    );
    const laptop = sessionHeaders(login);

    const wrong = await app.request(
      '/api/auth/password',
      withSession(
        jsonRequest('POST', { currentPassword: 'faux', newPassword: 'nouveau-mot-de-passe' }),
        phone,
      ),
    );
    expect(wrong.status).toBe(401);

    const res = await app.request(
      '/api/auth/password',
      withSession(
        jsonRequest('POST', {
          currentPassword: FRIEND.password,
          newPassword: 'nouveau-mot-de-passe',
        }),
        phone,
      ),
    );
    expect(res.status).toBe(204);
    expect((await app.request('/api/recipes', sessionHeaders(res))).status).toBe(200);
    expect((await app.request('/api/recipes', laptop)).status).toBe(401);
    expect((await app.request('/api/recipes', phone)).status).toBe(401);
  }, 30_000);

  it('n’écrase jamais le mot de passe du premier compte au redémarrage', async () => {
    const { db } = await setup();
    expect(bootstrapAdmin(db, { email: 'autre@example.fr', passwordHash: adminHash })).toBe(false);
  });

  it('exige une session pour changer de mot de passe', async () => {
    const { app } = await setup();
    const res = await app.request(
      '/api/auth/password',
      jsonRequest('POST', { currentPassword: 'x', newPassword: 'nouveau-mot-de-passe' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('migration', () => {
  it('crée le compte n° 1 administrateur, sans identifiants', () => {
    const { db } = createTestContext();
    expect(db.select().from(users).where(eq(users.id, 1)).get()).toMatchObject({
      name: 'dylan',
      email: null,
      passwordHash: null,
      isAdmin: true,
    });
  });
});
