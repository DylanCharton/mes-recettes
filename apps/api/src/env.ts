import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { PROJECT_ROOT } from './paths';

const booleanFlag = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().min(1).default('./data'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** URL publique (https://recettes.tojicode.fr) : contrôle de l'en-tête Origin derrière Caddy. */
  PUBLIC_URL: z.url({ protocol: /^https?$/ }).optional(),
  /**
   * Premier compte (n° 1, administrateur) : e-mail et empreinte scrypt du mot de passe, générée par
   * `pnpm --filter @mes-recettes/api hash-password`. Lus seulement tant que ce compte n'a pas de
   * mot de passe : les autres comptes arrivent par invitation (spec § 18.4).
   */
  ADMIN_EMAIL: z.email().optional(),
  AUTH_PASSWORD_HASH: z.string().startsWith('scrypt$').optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET : 32 caractères minimum').optional(),
  /** Scénario A uniquement (réseau local / Tailscale) : désactive l'authentification. */
  AUTH_DISABLED: booleanFlag,
  /** Front buildé servi par l'API ; par défaut apps/web/dist s'il existe. */
  WEB_DIST: z.string().optional(),
});

export type AdminBootstrap = { email: string; passwordHash: string };

/** Authentification désactivée : toutes les requêtes agissent au nom du compte n° 1. */
export type AuthConfig =
  { enabled: false } | { enabled: true; sessionSecret: string; secureCookie: boolean };

export type Env = Omit<
  z.infer<typeof EnvSchema>,
  'ADMIN_EMAIL' | 'AUTH_PASSWORD_HASH' | 'SESSION_SECRET' | 'AUTH_DISABLED' | 'WEB_DIST'
> & {
  auth: AuthConfig;
  adminBootstrap: AdminBootstrap | null;
  /** Dossier du front buildé, ou `null` (développement : Vite sert le front). */
  webDist: string | null;
  warnings: string[];
};

function fail(message: string): never {
  console.error(`Configuration invalide : ${message}`);
  process.exit(1);
}

/**
 * Lit et valide l'environnement. En production, le serveur refuse de démarrer sans secret de
 * session, sauf désactivation explicite (`AUTH_DISABLED=true`, spec § 18.2).
 */
export function loadEnv(): Env {
  try {
    // En développement, le .env est à la racine du projet ; en production, l'environnement suffit.
    process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  } catch {
    // Pas de fichier .env : normal en production.
  }

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) fail(z.prettifyError(parsed.error));

  const { ADMIN_EMAIL, AUTH_PASSWORD_HASH, SESSION_SECRET, AUTH_DISABLED, WEB_DIST, ...env } =
    parsed.data;
  const warnings: string[] = [];
  let auth: AuthConfig;

  if (Boolean(ADMIN_EMAIL) !== Boolean(AUTH_PASSWORD_HASH)) {
    fail('ADMIN_EMAIL et AUTH_PASSWORD_HASH vont ensemble : définissez les deux, ou aucun.');
  }
  const adminBootstrap =
    ADMIN_EMAIL && AUTH_PASSWORD_HASH
      ? { email: ADMIN_EMAIL, passwordHash: AUTH_PASSWORD_HASH }
      : null;

  if (AUTH_DISABLED) {
    auth = { enabled: false };
    warnings.push(
      'Authentification désactivée (AUTH_DISABLED=true) : à réserver à un réseau privé.',
    );
  } else if (SESSION_SECRET) {
    auth = {
      enabled: true,
      sessionSecret: SESSION_SECRET,
      secureCookie: env.NODE_ENV === 'production',
    };
  } else if (adminBootstrap || env.NODE_ENV === 'production') {
    fail('SESSION_SECRET manquant. Définissez-le, ou AUTH_DISABLED=true (réseau privé).');
  } else {
    auth = { enabled: false };
    warnings.push('Aucun SESSION_SECRET : authentification désactivée en développement.');
  }

  const webDist = path.resolve(PROJECT_ROOT, WEB_DIST ?? 'apps/web/dist');

  return {
    ...env,
    DATA_DIR: path.resolve(PROJECT_ROOT, env.DATA_DIR),
    auth,
    adminBootstrap,
    webDist: fs.existsSync(path.join(webDist, 'index.html')) ? webDist : null,
    warnings,
  };
}
