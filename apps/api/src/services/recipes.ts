import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  ingredientDisplayName,
  ingredientKey,
  normalizeText,
  parseIngredientLine,
  type ExistingRecipeSummary,
  type RecipeCard,
  type RecipeDetail,
  type RecipeInputParsed,
  type RecipeList,
  type RecipeListQuery,
  type RecipePatch,
  type RecipeSource,
  type Season,
} from '@mes-recettes/shared';
import type { Db, Tx } from '../db/client';
import {
  ingredients,
  recipeIngredients,
  recipes,
  recipeSeasons,
  recipeSteps,
  recipeTags,
  tags as tagsTable,
} from '../db/schema';
import { findOrCreateTags, tagsByRecipe } from './tags';

// Services synchrones : better-sqlite3 est synchrone et les transactions Drizzle associées
// n'acceptent pas de callback async. Un portage PostgreSQL les passera en async (spec § 11.1).

type RecipeRow = typeof recipes.$inferSelect;
type IngredientRow = typeof recipeIngredients.$inferSelect;
type StepRow = typeof recipeSteps.$inferSelect;

/** Ligne d'ingrédient prête à être insérée ; `ingredientId: undefined` = à rattacher. */
type LineData = Pick<
  IngredientRow,
  'originalText' | 'name' | 'quantity' | 'unit' | 'isOptional' | 'isPantry'
> & {
  ingredientId: number | null | undefined;
  /** Ligne structurée par une source : les parenthèses font partie de l'identité (§ 16.4). */
  structured?: boolean;
};

type IngredientLineInput = RecipeInputParsed['ingredients'][number];

const now = () => new Date().toISOString();
const localImageUrl = (imagePath: string | null) => (imagePath ? `/images/${imagePath}` : null);

/** Ligne fournie par un importeur (avec `name`) ou saisie (analysée ici). */
function toLine(input: IngredientLineInput): LineData {
  if (!input.name) return parseLine(input.text);
  return {
    originalText: input.text,
    name: input.name,
    quantity: input.quantity ?? null,
    unit: input.quantity == null ? null : (input.unit ?? null),
    isOptional: input.isOptional ?? false,
    isPantry: input.isPantry ?? false,
    ingredientId: undefined,
    structured: true,
  };
}

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

function findOrCreateIngredient(tx: Tx, name: string, keepParentheses: boolean): number | null {
  const key = ingredientKey(name, { keepParentheses });
  if (!key) return null;

  const existing = tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.normalizedName, key))
    .get();
  if (existing) return existing.id;

  return tx
    .insert(ingredients)
    .values({ name: ingredientDisplayName(name, { keepParentheses }), normalizedName: key })
    .returning({ id: ingredients.id })
    .get().id;
}

function recipeFields(input: RecipeInputParsed, lines: LineData[]) {
  const { prepMinutes = null, cookMinutes = null, totalMinutes = null } = input;
  const computedTotal =
    totalMinutes ??
    (prepMinutes !== null || cookMinutes !== null ? (prepMinutes ?? 0) + (cookMinutes ?? 0) : null);

  const fields = {
    title: input.title,
    description: input.description,
    servings: input.servings,
    servingsLabel: input.servingsLabel,
    prepMinutes,
    cookMinutes,
    totalMinutes: computedTotal,
    difficulty: input.difficulty,
    notes: input.notes,
    tools: input.tools,
    imagePath: input.imagePath ?? null,
    searchText: normalizeText([input.title, ...lines.map((line) => line.name)].join(' ')),
    status: input.status,
    isFavorite: input.isFavorite,
  };
  // Un champ absent de la requête n'écrase pas la valeur enregistrée (ex. difficulté importée).
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as {
    [K in keyof typeof fields]: Exclude<(typeof fields)[K], undefined>;
  } & { title: string };
}

function insertChildren(tx: Tx, recipeId: number, lines: LineData[], steps: string[]) {
  lines.forEach(({ structured = false, ...line }, position) => {
    const ingredientId =
      line.ingredientId !== undefined
        ? line.ingredientId
        : findOrCreateIngredient(tx, line.name, structured);
    tx.insert(recipeIngredients)
      .values({ ...line, ingredientId, recipeId, position })
      .run();
  });
  steps.forEach((text, position) => {
    tx.insert(recipeSteps).values({ recipeId, position, text }).run();
  });
}

/** Image locale, sinon image distante en repli (téléchargement échoué, spec § 19). */
const imageUrl = (row: { imagePath: string | null; imageSourceUrl: string | null }) =>
  localImageUrl(row.imagePath) ?? row.imageSourceUrl;

/** Remplace tags et saisons quand la requête les fournit (absents = inchangés). */
function setTagsAndSeasons(
  tx: Tx,
  recipeId: number,
  input: { tags?: string[]; seasons?: Season[] },
) {
  if (input.tags !== undefined) {
    tx.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId)).run();
    for (const tagId of findOrCreateTags(tx, input.tags)) {
      tx.insert(recipeTags).values({ recipeId, tagId }).run();
    }
  }
  if (input.seasons !== undefined) {
    tx.delete(recipeSeasons).where(eq(recipeSeasons.recipeId, recipeId)).run();
    for (const season of new Set(input.seasons)) {
      tx.insert(recipeSeasons).values({ recipeId, season }).run();
    }
  }
}

function toDetail(
  recipe: RecipeRow,
  lines: IngredientRow[],
  steps: StepRow[],
  extra: Pick<RecipeDetail, 'tags' | 'seasons'>,
): RecipeDetail {
  return {
    ...extra,
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
    imageUrl: imageUrl(recipe),
    source: recipe.source,
    sourceUrl: recipe.sourceUrl,
    externalId: recipe.externalId,
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

  const seasons = db
    .select({ season: recipeSeasons.season })
    .from(recipeSeasons)
    .where(eq(recipeSeasons.recipeId, id))
    .all()
    .map((row) => row.season);

  return toDetail(recipe, lines, steps, {
    tags: tagsByRecipe(db, [id]).get(id) ?? [],
    seasons: SEASON_ORDER.filter((season) => seasons.includes(season)),
  });
}

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Motif LIKE « contient », avec échappement de %, _ et \ (spec § 18.1). */
const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const likeContains = (column: SQL, value: string) =>
  sql`${column} like ${containsPattern(value)} escape '\\'`;

function listConditions(db: Db, query: RecipeListQuery): SQL[] {
  const conditions: SQL[] = [];
  const oneRow = { one: sql`1` };

  // Par défaut, les archivées sont masquées (spec F3).
  if (query.status?.length) conditions.push(inArray(recipes.status, query.status));
  else conditions.push(ne(recipes.status, 'archived'));

  if (query.favorite) conditions.push(eq(recipes.isFavorite, true));
  if (query.source) conditions.push(eq(recipes.source, query.source));
  if (query.maxTime) {
    conditions.push(
      and(isNotNull(recipes.totalMinutes), lte(recipes.totalMinutes, query.maxTime))!,
    );
  }

  // Texte : chaque mot doit apparaître dans le titre, un ingrédient ou un tag.
  for (const word of normalizeText(query.q ?? '')
    .split(' ')
    .filter(Boolean)) {
    const inTags = db
      .select(oneRow)
      .from(recipeTags)
      .innerJoin(tagsTable, eq(tagsTable.id, recipeTags.tagId))
      .where(
        and(
          eq(recipeTags.recipeId, recipes.id),
          likeContains(sql`${tagsTable.normalizedName}`, word),
        ),
      );
    conditions.push(or(likeContains(sql`${recipes.searchText}`, word), exists(inTags))!);
  }

  // Tags : tous exigés (ET).
  for (const tagId of query.tags ?? []) {
    const hasTag = db
      .select(oneRow)
      .from(recipeTags)
      .where(and(eq(recipeTags.recipeId, recipes.id), eq(recipeTags.tagId, tagId)));
    conditions.push(exists(hasTag));
  }

  // Saisons : l'une ou l'autre (OU) ; une recette sans saison ne correspond jamais (arbitrage A8).
  if (query.seasons?.length) {
    const inSeason = db
      .select(oneRow)
      .from(recipeSeasons)
      .where(
        and(eq(recipeSeasons.recipeId, recipes.id), inArray(recipeSeasons.season, query.seasons)),
      );
    conditions.push(exists(inSeason));
  }

  // Ingrédient : clé canonique (« poulets » trouve « Poulet (escalope) »).
  const key = query.ingredient ? ingredientKey(query.ingredient) : '';
  if (key) {
    const hasIngredient = db
      .select(oneRow)
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .where(
        and(
          eq(recipeIngredients.recipeId, recipes.id),
          likeContains(sql`${ingredients.normalizedName}`, key),
        ),
      );
    conditions.push(exists(hasIngredient));
  }

  return conditions;
}

const SORTS = {
  recent: [desc(recipes.createdAt), desc(recipes.id)],
  // search_text commence par le titre normalisé (sans accents) : « Pâtes » avant « Poulet ».
  title: [asc(recipes.searchText), asc(recipes.id)],
  time: [sql`${recipes.totalMinutes} is null`, asc(recipes.totalMinutes), asc(recipes.title)],
  updated: [desc(recipes.updatedAt), desc(recipes.id)],
} satisfies Record<RecipeListQuery['sort'], SQL[]>;

export function listRecipes(db: Db, query: RecipeListQuery): RecipeList {
  const where = and(...listConditions(db, query));
  const rows = db
    .select({
      id: recipes.id,
      title: recipes.title,
      imagePath: recipes.imagePath,
      imageSourceUrl: recipes.imageSourceUrl,
      totalMinutes: recipes.totalMinutes,
      status: recipes.status,
      isFavorite: recipes.isFavorite,
    })
    .from(recipes)
    .where(where)
    .orderBy(...SORTS[query.sort])
    .limit(query.limit)
    .offset(query.offset)
    .all();
  const total = db.select({ value: count() }).from(recipes).where(where).get()?.value ?? 0;
  const tags = tagsByRecipe(
    db,
    rows.map((row) => row.id),
  );

  const items: RecipeCard[] = rows.map(({ imagePath, imageSourceUrl, ...row }) => ({
    ...row,
    imageUrl: imageUrl({ imagePath, imageSourceUrl }),
    tags: tags.get(row.id) ?? [],
  }));
  return { items, total };
}

/**
 * Recette déjà importée depuis la même source : même identifiant externe, sinon même URL
 * canonique (spec F12).
 */
export function findDuplicate(
  db: Db,
  source: RecipeSource,
  externalId: string | null | undefined,
  sourceUrl?: string | null,
): ExistingRecipeSummary | null {
  const conditions: SQL[] = [];
  if (externalId)
    conditions.push(and(eq(recipes.source, source), eq(recipes.externalId, externalId))!);
  if (sourceUrl) conditions.push(eq(recipes.sourceUrl, sourceUrl));
  if (conditions.length === 0) return null;

  const row = db
    .select({
      id: recipes.id,
      title: recipes.title,
      imagePath: recipes.imagePath,
      imageSourceUrl: recipes.imageSourceUrl,
    })
    .from(recipes)
    .where(or(...conditions))
    .orderBy(asc(recipes.id))
    .get();
  return row ? { id: row.id, title: row.title, imageUrl: imageUrl(row) } : null;
}

export function createRecipe(db: Db, input: RecipeInputParsed): RecipeDetail {
  const timestamp = now();
  const source = input.source ?? 'manual';
  // Champs de provenance : écrits une seule fois, à la création.
  const importFields = {
    source,
    sourceUrl: input.sourceUrl ?? null,
    externalId: input.externalId ?? null,
    sourcePayload: input.sourcePayload ?? null,
    imageSourceUrl: input.imageSourceUrl ?? null,
    importedAt: source === 'manual' ? null : timestamp,
    nutrition: input.nutrition ?? null,
    nutriScore: input.nutriScore ?? null,
    greenScore: input.greenScore ?? null,
    cuisine: input.cuisine ?? null,
  };

  return db.transaction((tx) => {
    const lines = input.ingredients.map(toLine);
    const { id } = tx
      .insert(recipes)
      .values({
        ...recipeFields(input, lines),
        ...importFields,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: recipes.id })
      .get();
    insertChildren(tx, id, lines, input.steps);
    setTagsAndSeasons(tx, id, input);
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

    const lines = input.ingredients.map((line): LineData => {
      const kept = reusable.get(line.text)?.shift();
      if (!kept) return toLine(line);
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
    setTagsAndSeasons(tx, id, input);

    return { recipe: getRecipe(tx, id)!, previousImagePath: existing.imagePath };
  });
}

export function patchRecipe(db: Db, id: number, patch: RecipePatch): RecipeDetail | null {
  return db.transaction((tx) => {
    const { seasons, ...fields } = patch;
    const updated = tx
      .update(recipes)
      .set({ ...fields, updatedAt: now() })
      .where(eq(recipes.id, id))
      .returning({ id: recipes.id })
      .get();
    if (!updated) return null;
    setTagsAndSeasons(tx, id, { seasons });
    return getRecipe(tx, id);
  });
}

/** Autocomplétion du filtre « ingrédient » : ingrédients utilisés, les plus fréquents d'abord. */
export function searchIngredients(db: Db, query: string) {
  const key = ingredientKey(query);
  return (
    db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        recipeCount: count(recipeIngredients.id),
      })
      .from(ingredients)
      .innerJoin(recipeIngredients, eq(recipeIngredients.ingredientId, ingredients.id))
      .where(key ? likeContains(sql`${ingredients.normalizedName}`, key) : undefined)
      .groupBy(ingredients.id)
      // Début du nom, puis début de mot, puis ailleurs (« po » : Poulet… avant Curry en poudre).
      .orderBy(
        key
          ? sql`case when ${ingredients.normalizedName} like ${`${key}%`} then 0 when ${ingredients.normalizedName} like ${`% ${key}%`} then 1 else 2 end`
          : sql`0`,
        desc(count(recipeIngredients.id)),
        asc(ingredients.name),
      )
      .limit(20)
      .all()
  );
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
