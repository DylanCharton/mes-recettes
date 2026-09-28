import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

/** Ouvre la base (`:memory:` pour les tests) et applique les migrations. */
export function createDb(filePath: string, migrationsDir: string) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema, casing: 'snake_case' });
  migrate(db, { migrationsFolder: migrationsDir });
  return db;
}
