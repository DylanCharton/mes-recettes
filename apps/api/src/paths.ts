import path from 'node:path';

// src/ (dev, tsx) et dist/ (bundle de production) sont tous deux un niveau sous apps/api.
export const API_ROOT = path.resolve(import.meta.dirname, '..');
export const PROJECT_ROOT = path.resolve(API_ROOT, '../..');
export const MIGRATIONS_DIR = path.join(API_ROOT, 'drizzle');
