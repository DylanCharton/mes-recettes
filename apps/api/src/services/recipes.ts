import { asc, count, desc, eq } from 'drizzle-orm';
import {
  ingredientDisplayName,
  ingredientKey,
  normalizeText,
  parseIngredientLine,
  type RecipeCard,
  type RecipeDetail,
  type RecipeInputParsed,
  type RecipeList,
  type RecipePatch,
} from '@mes-recettes/shared';
import type { Db } from '../db/client';
import { ingredients, recipeIngredients, recipes, recipeSteps } from '../db/schema';

// Services synchrones : better-sqlite3 est synchrone et les transactions Drizzle associées
// n'acceptent pas de callback async. Un portage PostgreSQL les passera en async (spec § 11.1).

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type RecipeRow = typeof recipes.$inferSelect;
type IngredientRow = typeof recipeIngredients.$inferSelect;
type StepRow = typeof recipeSteps.$inferSelect;

/** Ligne d'ingrédient prête à être insérée ; `ingredientId: undefined` = à rattacher. */
type LineData = Pick<
  IngredientRow,
  'originalText' | 'name' | 'quantity' | 'unit' | 'isOptional' | 'isPantry'
> & { ingredientId: number | null | undefined };

const now = () => new Date().toISOString();
const imageUrl = (imagePath: string | null) => (imagePath ? `/images/${imagePath}` : null);

function parseLine(text: string): LineData {
  const parsed = parseIngredientLine(text);
  return {
    originalText: text,
    name: parsed.name,
    quantity: parsed.quantity,
    unit: parsed.unit,
    isOptional: parsed.isOptional,
    isPantry: false,
    ingredientId: undefined,
  };
}

function findOrCreateIngredient(tx: Tx, name: string): number | null {
  const key = ingredientKey(name);
  if (!key) return null;

  const existing = tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.normalizedName, key))
    .get();
  if (existing) return existing.id;

  return tx
    .insert(ingredients)
    .values({ name: ingredientDisplayName(name), normalizedName: key })
    .returning({ id: ingredients.id })
    .get().id;
}

function recipeFields(input: RecipeInputParsed, lines: LineData[]) {
  const { prepMinutes = null, cookMinutes = null, totalMinutes = null } = input;
  const computedTotal =
    totalMinutes ??
    (prepMinutes !== null || cookMinutes !== null ? (prepMinutes ?? 0) + (cookMinutes ?? 0) : null);

  return {
    title: input.title,
    description: input.description,
    servings: input.servings,
    servingsLabel: input.servingsLabel,
    prepMinutes,
    cookMinutes,
    totalMinutes: computedTotal,
    difficulty: input.difficulty ?? null,
    notes: input.notes,
    tools: input.tools,
    imagePath: input.imagePath ?? null,
    searchText: normalizeText([input.title, ...lines.map((line) => line.name)].join(' ')),
    ...(input.status && { status: input.status }),
    ...(input.isFavorite !== undefined && { isFavorite: input.isFavorite }),
  };
}

function insertChildren(tx: Tx, recipeId: number, lines: LineData[], steps: string[]) {
  lines.forEach((line, position) => {
    const ingredientId =
      line.ingredientId !== undefined ? line.ingredientId : findOrCreateIngredient(tx, line.name);
    tx.insert(recipeIngredients)
      .values({ ...line, ingredientId, recipeId, position })
      .run();
  });
  steps.forEach((text, position) => {
    tx.insert(recipeSteps).values({ recipeId, position, text }).run();
  });
}

function toDetail(recipe: RecipeRow, lines: IngredientRow[], steps: StepRow[]): RecipeDetail {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    servingsLabel: recipe.servingsLabel,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    difficulty: recipe.difficulty,
    status: recipe.status,
    isFavorite: recipe.isFavorite,
    notes: recipe.notes,
    tools: recipe.tools ?? [],
    nutrition: recipe.nutrition ?? null,
    nutriScore: recipe.nutriScore,
    greenScore: recipe.greenScore,
    cuisine: recipe.cuisine,
    imagePath: recipe.imagePath,
    imageUrl: imageUrl(recipe.imagePath),
    source: recipe.source,
    sourceUrl: recipe.sourceUrl,
    importedAt: recipe.importedAt,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    ingredients: lines.map((line) => ({
      id: line.id,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unit: line.unit,
      name: line.name,
      originalText: line.originalText,
      isOptional: line.isOptional,
      isPantry: line.isPantry,
    })),
    steps: steps.map((step) => ({ id: step.id, text: step.text })),
  };
}

export function getRecipe(db: Db | Tx, id: number): RecipeDetail | null {
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) return null;

  const lines = db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(asc(recipeIngredients.position))
    .all();
  const steps = db
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, id))
    .orderBy(asc(recipeSteps.position))
    .all();

  return toDetail(recipe, lines, steps);
}

export function listRecipes(db: Db, options: { limit: number; offset: number }): RecipeList {
  const rows = db
    .select({
      id: recipes.id,
      title: recipes.title,
      imagePath: recipes.imagePath,
      totalMinutes: recipes.totalMinutes,
      status: recipes.status,
      isFavorite: recipes.isFavorite,
    })
    .from(recipes)
    .orderBy(desc(recipes.createdAt), desc(recipes.id))
    .limit(options.limit)
    .offset(options.offset)
    .all();
  const total = db.select({ value: count() }).from(recipes).get()?.value ?? 0;

  const items: RecipeCard[] = rows.map(({ imagePath, ...row }) => ({
    ...row,
    imageUrl: imageUrl(imagePath),
  }));
  return { items, total };
}

export function createRecipe(db: Db, input: RecipeInputParsed): RecipeDetail {
  const timestamp = now();
  return db.transaction((tx) => {
    const lines = input.ingredients.map((line) => parseLine(line.text));
    const { id } = tx
      .insert(recipes)
      .values({ ...recipeFields(input, lines), createdAt: timestamp, updatedAt: timestamp })
      .returning({ id: recipes.id })
      .get();
    insertChildren(tx, id, lines, input.steps);
    return getRecipe(tx, id)!;
  });
}

/**
 * Remplace les champs éditables. Une ligne d'ingrédient dont le texte est identique à une ligne
 * existante conserve ses données structurées (utile pour les données importées, plus précises
 * que le re-parsing) ; une ligne nouvelle ou modifiée est ré-analysée (spec F5).
 */
export function updateRecipe(
  db: Db,
  id: number,
  input: RecipeInputParsed,
): { recipe: RecipeDetail; previousImagePath: string | null } | null {
  return db.transaction((tx) => {
    const existing = tx
      .select({ imagePath: recipes.imagePath })
      .from(recipes)
      .where(eq(recipes.id, id))
      .get();
    if (!existing) return null;

    const reusable = new Map<string, IngredientRow[]>();
    for (const row of tx
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, id))
      .orderBy(asc(recipeIngredients.position))
      .all()) {
      reusable.set(row.originalText, [...(reusable.get(row.originalText) ?? []), row]);
    }

    const lines = input.ingredients.map(({ text }): LineData => {
      const kept = reusable.get(text)?.shift();
      if (!kept) return parseLine(text);
      const { originalText, name, quantity, unit, isOptional, isPantry, ingredientId } = kept;
      return { originalText, name, quantity, unit, isOptional, isPantry, ingredientId };
    });

    tx.update(recipes)
      .set({ ...recipeFields(input, lines), updatedAt: now() })
      .where(eq(recipes.id, id))
      .run();
    tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).run();
    tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, id)).run();
    insertChildren(tx, id, lines, input.steps);

    return { recipe: getRecipe(tx, id)!, previousImagePath: existing.imagePath };
  });
}

export function patchRecipe(db: Db, id: number, patch: RecipePatch): RecipeDetail | null {
  if (Object.keys(patch).length > 0) {
    db.update(recipes)
      .set({ ...patch, updatedAt: now() })
      .where(eq(recipes.id, id))
      .run();
  }
  return getRecipe(db, id);
}

export function deleteRecipe(db: Db, id: number): { imagePath: string | null } | null {
  return (
    db
      .delete(recipes)
      .where(eq(recipes.id, id))
      .returning({ imagePath: recipes.imagePath })
      .get() ?? null
  );
}
