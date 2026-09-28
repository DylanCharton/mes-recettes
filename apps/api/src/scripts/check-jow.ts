/**
 * Diagnostic manuel de l'import contre le vrai site (jamais utilisé par les tests) :
 *   pnpm --filter @mes-recettes/api check:jow <url> [--save]
 * `--save` enregistre la page comme nouvelle fixture de test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { findImporter } from '../importers/registry';
import { AppError } from '../lib/errors';
import { safeFetch } from '../lib/safeFetch';
import { API_ROOT } from '../paths';

const [rawUrl, ...flags] = process.argv.slice(2);
if (!rawUrl) {
  console.error('Usage : check:jow <url> [--save]');
  process.exit(1);
}

const url = new URL(rawUrl);
const importer = findImporter(url);
if (!importer) {
  console.error(`Aucun importeur pour ${url.hostname}`);
  process.exit(1);
}

try {
  const { fetchUrl, externalId } = importer.identify(url);
  const page = await safeFetch(fetchUrl, {
    allowedHosts: importer.pageHosts,
    expect: 'html',
    maxBytes: 3 * 1024 * 1024,
  });
  const html = new TextDecoder().decode(page.body);

  if (flags.includes('--save')) {
    const slug = new URL(page.url).pathname.split('/').filter(Boolean).at(-1) ?? externalId;
    const file = path.join(API_ROOT, 'test/fixtures', importer.source, `${slug}.html`);
    fs.writeFileSync(file, html);
    console.error(`Fixture enregistrée : ${path.relative(API_ROOT, file)}`);
  }

  const { draft, strategies, warnings } = importer.parse(html, new URL(page.url));
  const { sourcePayload: _payload, ...summary } = draft;
  console.error(`Stratégies : ${strategies.join(', ')}`);
  if (warnings.length > 0) console.error(`Avertissements :\n- ${warnings.join('\n- ')}`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} catch (err) {
  console.error(err instanceof AppError ? `${err.code} : ${err.message}` : err);
  process.exit(1);
}
