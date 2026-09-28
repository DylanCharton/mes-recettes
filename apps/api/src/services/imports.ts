import type { ImportPreviewResponse } from '@mes-recettes/shared';
import type { AppDeps } from '../app';
import { findImporter } from '../importers/registry';
import { AppError } from '../lib/errors';
import { safeFetch } from '../lib/safeFetch';
import { findDuplicate } from './recipes';

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Première URL http(s) d'un texte partagé, sans la ponctuation finale. */
export function extractUrl(text: string): string | null {
  const match = /https?:\/\/[^\s<>"'«»]+/i.exec(text);
  return match ? match[0].replace(/[).,;:!?]+$/, '') : null;
}

const unsupported = () =>
  new AppError(
    'UNSUPPORTED_URL',
    422,
    'Ce lien n’est pas pris en charge. Seules les recettes Jow sont importables pour l’instant.',
  );

/**
 * Analyse une URL sans rien enregistrer (spec § 15.3) : importeur, doublon (avant tout appel
 * réseau), téléchargement sécurisé, extraction, brouillon validé.
 */
export async function previewImport(
  { db, logger, fetch }: AppDeps,
  request: { url?: string; text?: string; force?: boolean },
): Promise<ImportPreviewResponse> {
  const raw = extractUrl(request.url ?? '') ?? extractUrl(request.text ?? '');
  if (!raw) throw unsupported();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw unsupported();
  }

  const importer = findImporter(url);
  if (!importer) throw unsupported();

  const { fetchUrl, canonicalUrl, externalId } = importer.identify(url);
  const log = logger.child({ provider: importer.source, externalId });

  if (!request.force) {
    const existing = findDuplicate(db, importer.source, externalId, canonicalUrl);
    if (existing) {
      log.info({ existingId: existing.id }, 'import.duplicate');
      return { status: 'duplicate', existing, canonicalUrl };
    }
  }

  const start = performance.now();
  try {
    const page = await safeFetch(
      fetchUrl,
      { allowedHosts: importer.pageHosts, expect: 'html', maxBytes: MAX_HTML_BYTES },
      fetch,
    );
    const result = importer.parse(new TextDecoder().decode(page.body), new URL(page.url));
    log.info(
      {
        strategies: result.strategies,
        warnings: result.warnings,
        durationMs: Math.round(performance.now() - start),
      },
      'import.preview',
    );
    return { status: 'ok', provider: importer.source, ...result };
  } catch (err) {
    log.warn(
      {
        code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
        durationMs: Math.round(performance.now() - start),
      },
      'import.failed',
    );
    throw err;
  }
}

/**
 * Télécharge l'image d'une recette importée (spec § 19). Un échec n'empêche jamais
 * l'enregistrement : l'image distante reste affichée en repli.
 */
export async function downloadImage(
  { images, logger, fetch }: AppDeps,
  imageUrl: string,
  allowedHosts: readonly string[],
): Promise<string | null> {
  try {
    const { body } = await safeFetch(
      imageUrl,
      { allowedHosts, expect: 'image', maxBytes: MAX_IMAGE_BYTES },
      fetch,
    );
    const imagePath = await images.save(body);
    if (!imagePath) logger.warn({ imageUrl }, 'image.download_failed: format non reconnu');
    return imagePath;
  } catch (err) {
    logger.warn(
      { imageUrl, err: err instanceof Error ? err.message : err },
      'image.download_failed',
    );
    return null;
  }
}
