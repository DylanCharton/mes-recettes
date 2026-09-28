import type {
  ImportStrategy,
  PartialImport,
  RecipeDraft,
  RecipeSource,
} from '@mes-recettes/shared';
import { AppError } from '../lib/errors';

export type ImportResult = {
  draft: RecipeDraft;
  strategies: ImportStrategy[];
  warnings: string[];
};

/**
 * Un importeur par source (spec § 15.4). `canHandle`, `identify` et `parse` sont pures :
 * le téléchargement est fait à l'extérieur, `parse` se teste sur une fixture HTML.
 */
export interface RecipeImporter {
  readonly source: RecipeSource;
  /** Hôtes autorisés pour la page (redirections comprises). */
  readonly pageHosts: readonly string[];
  /** Hôtes autorisés pour le téléchargement des images. */
  readonly imageHosts: readonly string[];
  canHandle(url: URL): boolean;
  /** URL à télécharger, URL canonique et identifiant externe, sans appel réseau. */
  identify(url: URL): { fetchUrl: string; canonicalUrl: string; externalId: string | null };
  parse(html: string, url: URL): ImportResult;
}

export function parseFailed(partial: PartialImport) {
  return new AppError(
    'PARSE_FAILED',
    422,
    'Impossible de lire cette recette. Vous pouvez la créer manuellement.',
    { partial },
  );
}
