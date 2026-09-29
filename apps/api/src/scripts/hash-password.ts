/**
 * Génère l'empreinte du mot de passe à placer dans AUTH_PASSWORD_HASH.
 *   pnpm --filter @mes-recettes/api hash-password
 *   docker run --rm -it <image> node apps/api/dist/hash-password.js
 * Le mot de passe est lu sur l'entrée standard (jamais passé en argument : historique du shell).
 */
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../lib/password';

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = await rl.question('Mot de passe (12 caractères minimum) : ');
rl.close();

if (password.length < 12) {
  console.error('Trop court : choisissez au moins 12 caractères.');
  process.exit(1);
}

process.stdout.write(`${await hashPassword(password)}\n`);
