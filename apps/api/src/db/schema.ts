import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { Nutrition, RecipeSource, RecipeStatus, Season } from '@mes-recettes/shared';

// Noms de colonnes en snake_case générés via l'option `casing` (client et drizzle-kit).
// Dates : texte ISO 8601 UTC, portable vers PostgreSQL (spec § 11.1).

/**
 * Comptes (spec § 18.4). Le compte n° 1, créé par la migration 0002, détient la bibliothèque
 * d'avant le multi-comptes ; son e-mail et son mot de passe sont posés au premier démarrage.
 */
export const users = sqliteTable('user', {
  id: integer().primaryKey({ autoIncrement: true }),
  /** Minuscules ; `null` tant que le compte n° 1 n'est pas initialisé. */
  email: text().unique(),
  name: text().notNull(),
  passwordHash: text(),
  isAdmin: integer({ mode: 'boolean' }).notNull().default(false),
  /** Incrémenté à chaque changement de mot de passe : invalide les autres sessions. */
  sessionVersion: integer().notNull().default(1),
  createdAt: text()
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

/** Lien d'invitation à usage unique ; seule l'empreinte SHA-256 du jeton est stockée. */
export const invitations = sqliteTable(
  'invitation',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    tokenHash: text().notNull().unique(),
    createdBy: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text().notNull(),
    expiresAt: text().notNull(),
    usedAt: text(),
    usedBy: integer().references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('invitation_created_by_idx').on(t.createdBy)],
);

export const recipes = sqliteTable(
  'recipe',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text(),
    servings: integer().notNull().default(2),
    servingsLabel: text(),
    prepMinutes: integer(),
    cookMinutes: integer(),
    totalMinutes: integer(),
    difficulty: integer(),
    status: text().$type<RecipeStatus>().notNull().default('to_try'),
    isFavorite: integer({ mode: 'boolean' }).notNull().default(false),
    notes: text(),
    tools: text({ mode: 'json' }).$type<string[]>(),
    nutrition: text({ mode: 'json' }).$type<Nutrition>(),
    nutriScore: text(),
    greenScore: text(),
    cuisine: text(),
    imagePath: text(),
    imageSourceUrl: text(),
    source: text().$type<RecipeSource>().notNull().default('manual'),
    sourceUrl: text(),
    externalId: text(),
    sourcePayload: text({ mode: 'json' }),
    searchText: text().notNull(),
    importedAt: text(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
  },
  (t) => [
    index('recipe_user_id_idx').on(t.userId),
    index('recipe_source_external_id_idx').on(t.source, t.externalId),
    index('recipe_source_url_idx').on(t.sourceUrl),
    index('recipe_status_idx').on(t.status),
    index('recipe_is_favorite_idx').on(t.isFavorite),
    index('recipe_total_minutes_idx').on(t.totalMinutes),
    index('recipe_created_at_idx').on(t.createdAt),
  ],
);

/** Dictionnaire d'ingrédients canoniques, commun à tous les comptes (aucune donnée personnelle). */
export const ingredients = sqliteTable('ingredient', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  normalizedName: text().notNull().unique(),
  createdAt: text()
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const recipeIngredients = sqliteTable(
  'recipe_ingredient',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    recipeId: integer()
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: integer().references(() => ingredients.id),
    position: integer().notNull(),
    quantity: real(),
    unit: text(),
    /** Nom tel qu'écrit dans cette ligne (« carottes »), utilisé pour l'affichage recalculé. */
    name: text().notNull(),
    originalText: text().notNull(),
    isOptional: integer({ mode: 'boolean' }).notNull().default(false),
    isPantry: integer({ mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('recipe_ingredient_recipe_id_idx').on(t.recipeId),
    index('recipe_ingredient_ingredient_id_idx').on(t.ingredientId),
  ],
);

export const recipeSteps = sqliteTable(
  'recipe_step',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    recipeId: integer()
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    text: text().notNull(),
  },
  (t) => [index('recipe_step_recipe_id_idx').on(t.recipeId)],
);

/** Tags propres à chaque compte. */
export const tags = sqliteTable(
  'tag',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Clé d'unicité par compte : minuscules, sans accents (« Végétarien » = « vegetarien »). */
    normalizedName: text().notNull(),
    createdAt: text()
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [uniqueIndex('tag_user_normalized_name_unique').on(t.userId, t.normalizedName)],
);

export const recipeTags = sqliteTable(
  'recipe_tag',
  {
    recipeId: integer()
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    tagId: integer()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.tagId] }),
    index('recipe_tag_tag_id_idx').on(t.tagId),
  ],
);

/** Liste fermée de saisons : enum dans le code, pas de table de référence (spec § 12.3). */
export const recipeSeasons = sqliteTable(
  'recipe_season',
  {
    recipeId: integer()
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    season: text().$type<Season>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.season] }),
    index('recipe_season_season_idx').on(t.season),
    check(
      'recipe_season_season_check',
      sql`${t.season} in ('spring', 'summer', 'autumn', 'winter')`,
    ),
  ],
);
