import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { normalizeText, type Tag, type TagRef } from '@mes-recettes/shared';
import type { Db, Tx } from '../db/client';
import { recipeTags, tags } from '../db/schema';
import { AppError } from '../lib/errors';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr');

const tagExists = (existing: TagRef) =>
  new AppError('TAG_EXISTS', 409, `Le tag « ${existing.name} » existe déjà`, { existing });

function findByName(db: Db | Tx, name: string): TagRef | undefined {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.normalizedName, normalizeText(name)))
    .get();
}

export function listTags(db: Db): Tag[] {
  return db
    .select({ id: tags.id, name: tags.name, recipeCount: count(recipeTags.recipeId) })
    .from(tags)
    .leftJoin(recipeTags, eq(recipeTags.tagId, tags.id))
    .groupBy(tags.id)
    .all()
    .sort(byName);
}

export function createTag(db: Db, name: string): Tag {
  const existing = findByName(db, name);
  if (existing) throw tagExists(existing);
  const tag = db
    .insert(tags)
    .values({ name, normalizedName: normalizeText(name) })
    .returning({ id: tags.id, name: tags.name })
    .get();
  return { ...tag, recipeCount: 0 };
}

/**
 * Renomme un tag. Si le nouveau nom est déjà pris par un autre tag, refuse sauf `merge` :
 * les recettes sont alors rattachées au tag existant et l'ancien est supprimé (spec F8).
 */
export function renameTag(db: Db, id: number, name: string, merge = false): TagRef | null {
  return db.transaction((tx) => {
    const tag = tx.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).get();
    if (!tag) return null;

    const target = findByName(tx, name);
    if (target && target.id !== id) {
      if (!merge) throw tagExists(target);
      tx.run(sql`
        insert or ignore into ${recipeTags} (recipe_id, tag_id)
        select recipe_id, ${target.id} from ${recipeTags} where tag_id = ${id}
      `);
      tx.delete(tags).where(eq(tags.id, id)).run();
      return target;
    }

    return tx
      .update(tags)
      .set({ name, normalizedName: normalizeText(name) })
      .where(eq(tags.id, id))
      .returning({ id: tags.id, name: tags.name })
      .get()!;
  });
}

export function deleteTag(db: Db, id: number): boolean {
  return db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id }).get() !== undefined;
}

/** Identifiants des tags nommés, créés au besoin (dans la transaction de la recette). */
export function findOrCreateTags(tx: Tx, names: readonly string[]): number[] {
  const ids = new Set<number>();
  for (const name of names) {
    const existing = findByName(tx, name);
    const id =
      existing?.id ??
      tx
        .insert(tags)
        .values({ name, normalizedName: normalizeText(name) })
        .returning({ id: tags.id })
        .get().id;
    ids.add(id);
  }
  return [...ids];
}

/** Tags de plusieurs recettes, triés par nom (une seule requête). */
export function tagsByRecipe(db: Db | Tx, recipeIds: readonly number[]): Map<number, TagRef[]> {
  const result = new Map<number, TagRef[]>();
  if (recipeIds.length === 0) return result;

  const rows = db
    .select({ recipeId: recipeTags.recipeId, id: tags.id, name: tags.name })
    .from(recipeTags)
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(inArray(recipeTags.recipeId, [...recipeIds]))
    .orderBy(asc(tags.name))
    .all();

  for (const { recipeId, ...tag } of rows) {
    result.set(recipeId, [...(result.get(recipeId) ?? []), tag]);
  }
  for (const list of result.values()) list.sort(byName);
  return result;
}
