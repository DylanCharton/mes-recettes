import type { RecipeSource } from '@mes-recettes/shared';
import { JowImporter } from './jow/JowImporter';
import type { RecipeImporter } from './types';

// Ordre = priorité. V1.5 : GenericSchemaOrgImporter en dernier (toute URL publique).
export const importers: readonly RecipeImporter[] = [new JowImporter()];

export function findImporter(url: URL): RecipeImporter | undefined {
  return importers.find((importer) => importer.canHandle(url));
}

export function importerForSource(source: RecipeSource): RecipeImporter | undefined {
  return importers.find((importer) => importer.source === source);
}
