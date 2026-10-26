import { and, desc, eq } from 'drizzle-orm';
import type { CookEntry, CookList } from '@mes-recettes/shared';
import type { Db } from '../db/client';
import { cookLogs, recipes } from '../db/schema';
import { imageUrl } from './recipes';

// Réalisations propres à chaque compte, comme les recettes qu'elles référencent.

/** Au-delà, la frise montre les plus récentes : une par jour pendant plus de cinq ans. */
const TIMELINE_LIMIT = 2000;

const entryColumns = {
  id: cookLogs.id,
  recipeId: cookLogs.recipeId,
  cookedAt: cookLogs.cookedAt,
  title: recipes.title,
  imagePath: recipes.imagePath,
  imageSourceUrl: recipes.imageSourceUrl,
};

const toEntry = ({
  imagePath,
  imageSourceUrl,
  ...row
}: {
  id: number;
  recipeId: number;
  cookedAt: string;
  title: string;
  imagePath: string | null;
  imageSourceUrl: string | null;
}): CookEntry => ({ ...row, imageUrl: imageUrl({ imagePath, imageSourceUrl }) });

/** Frise de l'accueil : de la plus ancienne à la plus récente. */
export function listCooks(db: Db, userId: number): CookList {
  const rows = db
    .select(entryColumns)
    .from(cookLogs)
    .innerJoin(recipes, eq(recipes.id, cookLogs.recipeId))
    .where(eq(cookLogs.userId, userId))
    .orderBy(desc(cookLogs.cookedAt), desc(cookLogs.id))
    .limit(TIMELINE_LIMIT)
    .all();
  return { items: rows.reverse().map(toEntry) };
}

/** `null` si la recette n'appartient pas au compte. */
export function addCook(
  db: Db,
  userId: number,
  recipeId: number,
  cookedAt: Date,
): CookEntry | null {
  const recipe = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
    .get();
  if (!recipe) return null;

  const { id } = db
    .insert(cookLogs)
    // toISOString : format UTC unique, l'ordre alphabétique est l'ordre chronologique.
    .values({ userId, recipeId, cookedAt: cookedAt.toISOString() })
    .returning({ id: cookLogs.id })
    .get();
  return toEntry(
    db
      .select(entryColumns)
      .from(cookLogs)
      .innerJoin(recipes, eq(recipes.id, cookLogs.recipeId))
      .where(eq(cookLogs.id, id))
      .get()!,
  );
}

export function deleteCook(db: Db, userId: number, id: number): boolean {
  return (
    db
      .delete(cookLogs)
      .where(and(eq(cookLogs.id, id), eq(cookLogs.userId, userId)))
      .returning({ id: cookLogs.id })
      .get() !== undefined
  );
}
