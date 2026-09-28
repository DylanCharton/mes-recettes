import path from 'node:path';
import { z } from 'zod';
import { PROJECT_ROOT } from './paths';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().min(1).default('./data'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof EnvSchema> & { DATA_DIR: string };

export function loadEnv(): Env {
  try {
    // En développement, le .env est à la racine du projet ; en production, l'environnement suffit.
    process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  } catch {
    // Pas de fichier .env : normal en production.
  }

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Variables d’environnement invalides :', z.prettifyError(parsed.error));
    process.exit(1);
  }

  return { ...parsed.data, DATA_DIR: path.resolve(PROJECT_ROOT, parsed.data.DATA_DIR) };
}
