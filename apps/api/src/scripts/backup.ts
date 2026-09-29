/**
 * Copie cohérente de la base, même pendant que l'application tourne (API backup de SQLite),
 * puis conserve les N dernières copies. Les images sont des fichiers immuables : un simple
 * rsync/tar de DATA_DIR/images suffit à côté.
 *   node apps/api/dist/backup.js [dossier] [nombre à garder]
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { loadEnv } from '../env';

const env = loadEnv();
const target = path.resolve(process.argv[2] ?? path.join(env.DATA_DIR, 'backups'));
const keep = Number(process.argv[3] ?? 14);

fs.mkdirSync(target, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(target, `app-${stamp}.db`);

const db = new Database(path.join(env.DATA_DIR, 'app.db'), { readonly: true, fileMustExist: true });
await db.backup(file);
db.close();

const backups = fs
  .readdirSync(target)
  .filter((name) => /^app-.+\.db$/.test(name))
  .sort()
  .reverse();
for (const old of backups.slice(keep)) fs.rmSync(path.join(target, old));

console.error(`Sauvegarde : ${file} (${backups.length > keep ? keep : backups.length} conservées)`);
