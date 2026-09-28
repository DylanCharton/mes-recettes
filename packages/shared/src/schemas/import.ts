import { z } from 'zod';
import type { RecipeInput } from './recipe';

export const ImportPreviewRequestSchema = z
  .object({
    url: z.string().trim().max(2000).optional(),
    /** Texte partagé depuis Android (« Découvre cette recette… https://jow.fr/… »). */
    text: z.string().trim().max(5000).optional(),
    force: z.boolean().optional(),
  })
  .refine((body) => body.url || body.text, { message: 'Indiquez un lien', path: ['url'] });
export type ImportPreviewRequest = z.input<typeof ImportPreviewRequestSchema>;

export type ImportStrategy = 'json_ld' | 'next_data' | 'open_graph';

/** Brouillon d'import : un `RecipeInput` pré-rempli, jamais enregistré tel quel. */
export type RecipeDraft = RecipeInput;

export type ExistingRecipeSummary = { id: number; title: string; imageUrl: string | null };

export type ImportPreviewResponse =
  | {
      status: 'ok';
      draft: RecipeDraft;
      provider: string;
      strategies: ImportStrategy[];
      warnings: string[];
    }
  | { status: 'duplicate'; existing: ExistingRecipeSummary; canonicalUrl: string };

/** Données minimales trouvées quand l'analyse échoue (proposées pour une saisie manuelle). */
export type PartialImport = { title?: string; imageUrl?: string; sourceUrl: string };
