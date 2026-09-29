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
  /** Empreinte scrypt du mot de passe, générée par `pnpm --filter @mes-recettes/api hash-password`. */
  AUTH_PASSWORD_HASH: z.string().startsWith('scrypt$').optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET : 32 caractères minimum').optional(),
  /** Scénario A uniquement (réseau local / Tailscale) : désactive l'authentification. */
  AUTH_DISABLED: booleanFlag,
  /** Front buildé servi par l'API ; par défaut apps/web/dist s'il existe. */
  WEB_DIST: z.string().optional(),
});

export type AuthConfig =
  | { enabled: false }
  | { enabled: true; passwordHash: string; sessionSecret: string; secureCookie: boolean };

export type Env = Omit<
  z.infer<typeof EnvSchema>,
  'AUTH_PASSWORD_HASH' | 'SESSION_SECRET' | 'AUTH_DISABLED' | 'WEB_DIST'
> & {
  auth: AuthConfig;
  /** Dossier du front buildé, ou `null` (développement : Vite sert le front). */
  webDist: string | null;
  warnings: string[];
};

function fail(message: string): never {
  console.error(`Configuration invalide : ${message}`);
  process.exit(1);
}

/**
 * Lit et valide l'environnement. En production, le serveur refuse de démarrer sans mot de passe,
 * sauf désactivation explicite (`AUTH_DISABLED=true`, spec § 18.2).
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

  const { AUTH_PASSWORD_HASH, SESSION_SECRET, AUTH_DISABLED, WEB_DIST, ...env } = parsed.data;
  const warnings: string[] = [];
  let auth: AuthConfig;

  if (AUTH_DISABLED) {
    auth = { enabled: false };
    warnings.push(
      'Authentification désactivée (AUTH_DISABLED=true) : à réserver à un réseau privé.',
    );
  } else if (AUTH_PASSWORD_HASH) {
    if (!SESSION_SECRET) fail('SESSION_SECRET est requis quand AUTH_PASSWORD_HASH est défini.');
    auth = {
      enabled: true,
      passwordHash: AUTH_PASSWORD_HASH,
      sessionSecret: SESSION_SECRET,
      secureCookie: env.NODE_ENV === 'production',
    };
  } else if (env.NODE_ENV === 'production') {
    fail(
      'AUTH_PASSWORD_HASH manquant. Définissez un mot de passe ou AUTH_DISABLED=true (réseau privé).',
    );
  } else {
    auth = { enabled: false };
    warnings.push('Aucun mot de passe configuré : authentification désactivée en développement.');
  }

  const webDist = path.resolve(PROJECT_ROOT, WEB_DIST ?? 'apps/web/dist');

  return {
    ...env,
    DATA_DIR: path.resolve(PROJECT_ROOT, env.DATA_DIR),
    auth,
    webDist: fs.existsSync(path.join(webDist, 'index.html')) ? webDist : null,
    warnings,
  };
}
