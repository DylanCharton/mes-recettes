// Bundle de production : un fichier par point d'entrée dans dist/, `packages/shared` inclus.
// better-sqlite3 (binaire natif) reste externe : il est copié tel quel dans l'image Docker.
import { build } from 'esbuild';

await build({
  entryPoints: {
    server: 'src/index.ts',
    'hash-password': 'src/scripts/hash-password.ts',
    backup: 'src/scripts/backup.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['better-sqlite3', 'pino-pretty'],
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  // Les dépendances CommonJS (pino…) appellent require() : on le fournit au bundle ESM.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
