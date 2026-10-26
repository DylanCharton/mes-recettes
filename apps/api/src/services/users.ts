import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { CreatedInvitation, Invitation, SessionUser } from '@mes-recettes/shared';
import type { Db, Tx } from '../db/client';
import { invitations, users } from '../db/schema';
import type { AdminBootstrap } from '../env';
import { AppError } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';

// Comptes et invitations (spec § 18.4). Un compte n'arrive que par invitation d'un
// administrateur ; le premier est initialisé par l'environnement.

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Compte rattaché aux requêtes quand l'authentification est désactivée. */
export const DEFAULT_USER_ID = 1;

const sessionUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  isAdmin: users.isAdmin,
};

const now = () => new Date().toISOString();
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function getUser(db: Db, id: number): (SessionUser & { sessionVersion: number }) | null {
  return (
    db
      .select({ ...sessionUserColumns, sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, id))
      .get() ?? null
  );
}

/**
 * Initialise le premier administrateur sans mot de passe (compte n° 1 créé par la migration
 * 0002) avec l'e-mail et l'empreinte fournis. Ne remplace jamais un mot de passe existant.
 */
export function bootstrapAdmin(db: Db, bootstrap: AdminBootstrap): boolean {
  const email = bootstrap.email.trim().toLowerCase();
  return db.transaction((tx) => {
    const admin = tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isAdmin, true), isNull(users.passwordHash)))
      .orderBy(asc(users.id))
      .get();
    if (!admin) return false;
    const taken = tx.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
    if (taken && taken.id !== admin.id) return false;
    tx.update(users)
      .set({ email, passwordHash: bootstrap.passwordHash })
      .where(eq(users.id, admin.id))
      .run();
    return true;
  });
}

/** Au moins un compte peut se connecter (sinon le serveur n'est accessible à personne). */
export function hasLoginableUser(db: Db): boolean {
  return (
    db
      .select({ id: users.id })
      .from(users)
      .where(and(isNotNull(users.email), isNotNull(users.passwordHash)))
      .get() !== undefined
  );
}

// Empreinte factice : un e-mail inconnu coûte autant qu'un mauvais mot de passe (pas
// d'énumération des comptes par la durée de réponse).
let dummyHash: Promise<string> | undefined;

export async function authenticate(
  db: Db,
  email: string,
  password: string,
): Promise<{ id: number; sessionVersion: number } | null> {
  const user = db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .get();
  if (!user?.passwordHash) {
    await verifyPassword(password, await (dummyHash ??= hashPassword('mot-de-passe-factice')));
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, sessionVersion: user.sessionVersion };
}

/** Change le mot de passe et invalide les sessions des autres appareils. */
export async function changePassword(
  db: Db,
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<{ sessionVersion: number }> {
  const user = db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Mot de passe actuel incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  return db
    .update(users)
    .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion })
    .get()!;
}

export function createInvitation(db: Db, createdBy: number): CreatedInvitation {
  const token = randomBytes(24).toString('base64url');
  const createdAt = new Date();
  const row = db
    .insert(invitations)
    .values({
      tokenHash: sha256(token),
      createdBy,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + INVITATION_TTL_MS).toISOString(),
    })
    .returning({
      id: invitations.id,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
    })
    .get();
  return { ...row, token };
}

/** Invitations de cet administrateur encore utilisables. */
export function listInvitations(db: Db, createdBy: number): Invitation[] {
  return db
    .select({
      id: invitations.id,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.createdBy, createdBy),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, now()),
      ),
    )
    .orderBy(asc(invitations.createdAt))
    .all();
}

export function revokeInvitation(db: Db, createdBy: number, id: number): boolean {
  return (
    db
      .delete(invitations)
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.createdBy, createdBy),
          isNull(invitations.usedAt),
        ),
      )
      .returning({ id: invitations.id })
      .get() !== undefined
  );
}

const invalidInvitation = () =>
  new AppError(
    'INVITATION_INVALID',
    404,
    'Ce lien d’invitation n’est plus valable. Demandez-en un nouveau.',
  );

function findUsableInvitation(db: Db | Tx, token: string) {
  return db
    .select({ id: invitations.id, invitedBy: users.name })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.createdBy))
    .where(
      and(
        eq(invitations.tokenHash, sha256(token)),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, now()),
      ),
    )
    .get();
}

export function checkInvitation(db: Db, token: string): { invitedBy: string } {
  const invitation = findUsableInvitation(db, token);
  if (!invitation) throw invalidInvitation();
  return { invitedBy: invitation.invitedBy };
}

/** Crée le compte invité ; l'invitation est consommée dans la même transaction. */
export async function acceptInvitation(
  db: Db,
  token: string,
  input: { name: string; email: string; password: string },
): Promise<{ id: number; sessionVersion: number }> {
  if (!findUsableInvitation(db, token)) throw invalidInvitation();
  // Hachage hors transaction (asynchrone) ; l'invitation est revérifiée ensuite.
  const passwordHash = await hashPassword(input.password);

  return db.transaction((tx) => {
    const invitation = findUsableInvitation(tx, token);
    if (!invitation) throw invalidInvitation();
    if (tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get()) {
      throw new AppError('EMAIL_TAKEN', 409, 'Un compte existe déjà avec cette adresse e-mail');
    }

    const user = tx
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .returning({ id: users.id, sessionVersion: users.sessionVersion })
      .get();
    tx.update(invitations)
      .set({ usedAt: now(), usedBy: user.id })
      .where(eq(invitations.id, invitation.id))
      .run();
    return user;
  });
}
