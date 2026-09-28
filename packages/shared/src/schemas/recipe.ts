import { z } from 'zod';

export const RECIPE_STATUSES = ['to_try', 'validated', 'archived'] as const;
export const RecipeStatusSchema = z.enum(RECIPE_STATUSES);
export type RecipeStatus = z.infer<typeof RecipeStatusSchema>;

export const RECIPE_SOURCES = ['manual', 'jow', 'schema_org'] as const;
export const RecipeSourceSchema = z.enum(RECIPE_SOURCES);
export type RecipeSource = z.infer<typeof RecipeSourceSchema>;

export const LIMITS = {
  title: 200,
  description: 2000,
  notes: 5000,
  ingredientText: 300,
  ingredients: 100,
  stepText: 2000,
  steps: 60,
  tool: 80,
  tools: 30,
} as const;

/** Nom de fichier d'image locale généré par le serveur (UUID + extension). */
export const IMAGE_PATH_REGEX = /^[a-f0-9-]{36}\.(?:jpg|png|webp)$/;

const minutes = z
  .int()
  .min(0)
  .max(24 * 60)
  .nullish();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    // Chaîne vide → null ; absent (undefined) reste absent pour ne pas écraser à la modification.
    .transform((value) => (value === undefined ? undefined : value || null));

export const NutritionSchema = z.object({
  kcal: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  sugar: z.number().min(0).optional(),
  salt: z.number().min(0).optional(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

/**
 * Ligne d’ingrédient. `text` (texte original) est obligatoire ; les champs structurés sont
 * fournis par un importeur. Sans `name`, le serveur analyse le texte lui-même.
 */
export const IngredientInputSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.ingredientText),
  name: z.string().trim().min(1).max(LIMITS.ingredientText).optional(),
  quantity: z.number().positive().max(1e6).nullish(),
  unit: z.string().trim().min(1).max(30).nullish(),
  isOptional: z.boolean().optional(),
  isPantry: z.boolean().optional(),
});
export type IngredientInput = z.input<typeof IngredientInputSchema>;

export const RecipeInputSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(LIMITS.title),
  description: optionalText(LIMITS.description),
  servings: z.int().min(1).max(100),
  servingsLabel: optionalText(80),
  prepMinutes: minutes,
  cookMinutes: minutes,
  totalMinutes: minutes,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullish(),
  ingredients: z.array(IngredientInputSchema).max(LIMITS.ingredients).default([]),
  steps: z.array(z.string().trim().min(1).max(LIMITS.stepText)).max(LIMITS.steps).default([]),
  tools: z.array(z.string().trim().min(1).max(LIMITS.tool)).max(LIMITS.tools).default([]),
  notes: optionalText(LIMITS.notes),
  status: RecipeStatusSchema.optional(),
  isFavorite: z.boolean().optional(),
  imagePath: z.string().regex(IMAGE_PATH_REGEX).nullish(),
  // Champs fournis par un import (enregistrés à la création uniquement).
  nutrition: NutritionSchema.nullish(),
  nutriScore: z.string().trim().max(3).nullish(),
  greenScore: z.string().trim().max(3).nullish(),
  cuisine: optionalText(80),
  source: RecipeSourceSchema.optional(),
  sourceUrl: z
    .url({ protocol: /^https?$/ })
    .max(2000)
    .nullish(),
  externalId: z.string().trim().min(1).max(100).nullish(),
  sourcePayload: z.unknown().optional(),
  /** Image distante à télécharger à l’enregistrement (ignorée si `imagePath` est fourni). */
  imageSourceUrl: z
    .url({ protocol: /^https$/ })
    .max(2000)
    .nullish(),
  /** « Importer quand même » : ignore la détection de doublon. */
  force: z.boolean().optional(),
});
export type RecipeInput = z.input<typeof RecipeInputSchema>;
export type RecipeInputParsed = z.output<typeof RecipeInputSchema>;

export const RecipePatchSchema = z
  .object({
    status: RecipeStatusSchema,
    isFavorite: z.boolean(),
    notes: optionalText(LIMITS.notes),
  })
  .partial();
export type RecipePatch = z.input<typeof RecipePatchSchema>;

export const RecipeListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

export type RecipeIngredient = {
  id: number;
  ingredientId: number | null;
  quantity: number | null;
  unit: string | null;
  name: string;
  originalText: string;
  isOptional: boolean;
  isPantry: boolean;
};

export type RecipeStep = { id: number; text: string };

export type RecipeDetail = {
  id: number;
  title: string;
  description: string | null;
  servings: number;
  servingsLabel: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  difficulty: number | null;
  status: RecipeStatus;
  isFavorite: boolean;
  notes: string | null;
  tools: string[];
  nutrition: Nutrition | null;
  nutriScore: string | null;
  greenScore: string | null;
  cuisine: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  source: RecipeSource;
  sourceUrl: string | null;
  externalId: string | null;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type RecipeCard = Pick<
  RecipeDetail,
  'id' | 'title' | 'imageUrl' | 'totalMinutes' | 'status' | 'isFavorite'
>;

export type RecipeList = { items: RecipeCard[]; total: number };
