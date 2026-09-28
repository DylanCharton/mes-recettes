import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach } from 'vitest';
import { createApp } from '../src/app';
import { createDb } from '../src/db/client';
import { createImageStore } from '../src/lib/imageStore';
import { MIGRATIONS_DIR } from '../src/paths';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

export function createTestContext() {
  const imagesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mes-recettes-'));
  tempDirs.push(imagesDir);

  const db = createDb(':memory:', MIGRATIONS_DIR);
  const images = createImageStore(imagesDir);
  const app = createApp({ db, logger: pino({ level: 'silent' }), images });
  return { app, db, images, imagesDir };
}

export function createTestApp() {
  return createTestContext().app;
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** Plus petit JPEG reconnaissable par ses octets magiques (le contenu n'est pas décodé). */
export const FAKE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
