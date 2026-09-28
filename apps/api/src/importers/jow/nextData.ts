import { z } from 'zod';

// Schéma volontairement permissif de `props.pageProps.recipe` : on ne valide que ce qu'on lit,
// tout le reste passe (`loose`). Structure interne de Jow, non contractuelle (spec § 15.1).

const Named = z.object({ name: z.string() }).loose();

const JowUnit = z
  .object({
    name: z.string(),
    abbreviations: z.array(z.object({ label: z.string() }).loose()).optional(),
  })
  .loose();

export const JowConstituentSchema = z
  .object({
    name: z.string().optional(),
    quantityPerCover: z.number().nullish(),
    unit: JowUnit.nullish(),
    isOptional: z.boolean().optional(),
    // Les `additionalConstituents` (« à avoir chez soi ») portent le nom dans `ingredient`.
    ingredient: Named.nullish(),
  })
  .loose();
export type JowConstituent = z.infer<typeof JowConstituentSchema>;

export const JowRecipeSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().nullish(),
    coversCount: z.number().int().min(1).max(100),
    constituents: z.array(JowConstituentSchema),
    additionalConstituents: z.array(JowConstituentSchema).optional(),
    directions: z.array(z.object({ label: z.string() }).loose()).optional(),
    requiredTools: z.array(Named).optional(),
    nutritionalFacts: z.array(z.object({ id: z.string(), amount: z.number() }).loose()).optional(),
    nutritionalRatingScores: z
      .array(z.object({ id: z.string(), score: z.string() }).loose())
      .optional(),
    difficulty: z.number().nullish(),
    preparationTime: z.number().nullish(),
    cookingTime: z.number().nullish(),
    origin: Named.nullish(),
  })
  .loose();
export type JowRecipe = z.infer<typeof JowRecipeSchema>;

const NextDataSchema = z.object({
  props: z.object({ pageProps: z.object({ recipe: z.unknown() }).loose() }).loose(),
});

/** Recette Jow validée, ou la raison de l'échec (absent / structure inattendue). */
export function readJowRecipe(
  nextData: unknown,
): { ok: true; recipe: JowRecipe } | { ok: false; reason: 'missing' | 'invalid' } {
  if (nextData === undefined) return { ok: false, reason: 'missing' };
  const page = NextDataSchema.safeParse(nextData);
  if (!page.success) return { ok: false, reason: 'invalid' };
  const recipe = JowRecipeSchema.safeParse(page.data.props.pageProps.recipe);
  return recipe.success ? { ok: true, recipe: recipe.data } : { ok: false, reason: 'invalid' };
}
