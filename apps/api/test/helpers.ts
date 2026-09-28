import pino from 'pino';
import { createApp } from '../src/app';
import { createDb } from '../src/db/client';
import { MIGRATIONS_DIR } from '../src/paths';

export function createTestApp() {
  const db = createDb(':memory:', MIGRATIONS_DIR);
  return createApp({ db, logger: pino({ level: 'silent' }) });
}
