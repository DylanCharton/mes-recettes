/**
 * Administration des comptes (pas de récupération par e-mail, spec § 18.4).
 *   pnpm --filter @mes-recettes/api users list
 *   pnpm --filter @mes-recettes/api users reset-password <email>
 *   docker compose exec -it app node apps/api/dist/users.js reset-password <email>
 * Le nouveau mot de passe est lu sur l'entrée standard (jamais passé en argument : historique).
 */
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { count, eq, sql } from 'drizzle-orm';
import { PASSWORD_MIN_LENGTH } from '@mes-recettes/shared';
import { createDb } from '../db/client';
import { recipes, users } from '../db/schema';
import { loadEnv } from '../env';
import { hashPassword } from '../lib/password';
import { MIGRATIONS_DIR } from '../paths';

const env = loadEnv();
const db = createDb(path.join(env.DATA_DIR, 'app.db'), MIGRATIONS_DIR);
const [command, email] = process.argv.slice(2);

if (command === 'list') {
  const rows = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      recipes: count(recipes.id),
    })
    .from(users)
    .leftJoin(recipes, eq(recipes.userId, users.id))
    .groupBy(users.id)
    .all();
  console.table(rows);
} else if (command === 'reset-password' && email) {
  const user = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .get();
  if (!user) {
    console.error(`Aucun compte pour ${email}.`);
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const password = await rl.question(
    `Nouveau mot de passe (${PASSWORD_MIN_LENGTH} caractères minimum) : `,
  );
  rl.close();
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(`Trop court : choisissez au moins ${PASSWORD_MIN_LENGTH} caractères.`);
    process.exit(1);
  }
  // Nouvelle version de session : tous les appareils du compte sont déconnectés.
  db.update(users)
    .set({
      passwordHash: await hashPassword(password),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, user.id))
    .run();
  console.error('Mot de passe changé ; le compte est déconnecté de tous ses appareils.');
} else {
  console.error('Usage : users list | users reset-password <email>');
  process.exit(1);
}
