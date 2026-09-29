import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach } from 'vitest';
import { createApp } from '../src/app';
import { createDb } from '../src/db/client';
import type { AuthConfig } from '../src/env';
import { createImageStore } from '../src/lib/imageStore';
import type { FetchFn } from '../src/lib/safeFetch';
import { MIGRATIONS_DIR } from '../src/paths';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** `fetch` par défaut des tests : tout appel réseau non simulé échoue bruyamment. */
const noNetwork: FetchFn = async (url) => {
  throw new Error(`Appel réseau inattendu dans un test : ${String(url)}`);
};

export function createTestContext(
  options: { fetch?: FetchFn; auth?: AuthConfig; webDist?: string } = {},
) {
  const imagesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mes-recettes-'));
  tempDirs.push(imagesDir);

  const db = createDb(':memory:', MIGRATIONS_DIR);
  const images = createImageStore(imagesDir);
  const app = createApp({
    db,
    logger: pino({ level: 'silent' }),
    images,
    fetch: options.fetch ?? noNetwork,
    auth: options.auth ?? { enabled: false },
    webDist: options.webDist,
  });
  // Comme un navigateur sur la même origine : le middleware CSRF exige Origin ou Sec-Fetch-Site.
  const request = (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('sec-fetch-site')) headers.set('sec-fetch-site', 'same-origin');
    return app.request(input, { ...init, headers });
  };
  return { app: { request, raw: app }, db, images, imagesDir };
}

export function createTestApp() {
  return createTestContext().app;
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** Plus petit JPEG reconnaissable par ses octets magiques (le contenu n'est pas décodé). */
export const FAKE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
