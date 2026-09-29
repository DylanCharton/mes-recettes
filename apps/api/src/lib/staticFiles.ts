import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/**
 * Sert le front buildé (spec § 10.1) : fichiers de `dist/`, sinon `index.html` (routes du SPA).
 * Les fichiers de `assets/` ont un nom haché → cache immuable ; le reste (index.html, sw.js,
 * manifeste) est revalidé à chaque visite pour que les mises à jour arrivent tout de suite.
 */
export function createStaticHandler(root: string) {
  const index = path.join(root, 'index.html');

  return async (c: Context) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      pathname = '/';
    }

    // path.join normalise « .. » : on vérifie que le fichier reste bien dans `root`.
    const candidate = path.join(root, pathname);
    const isInside = candidate.startsWith(root + path.sep);
    const file =
      isInside && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : index;

    const hashed = file.startsWith(path.join(root, 'assets') + path.sep);
    return c.body(new Uint8Array(await fsp.readFile(file)), 200, {
      'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
  };
}
