import { z } from 'zod';

export const TAG_MAX_LENGTH = 40;

export const TagNameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom du tag est obligatoire')
  .max(TAG_MAX_LENGTH)
  .transform((name) => name.replace(/\s+/g, ' '));

export const TagCreateSchema = z.object({ name: TagNameSchema });

export const TagRenameSchema = z.object({
  name: TagNameSchema,
  /** Renommer vers un nom existant fusionne les deux tags (après confirmation côté client). */
  merge: z.boolean().optional(),
});

export type TagRef = { id: number; name: string };
export type Tag = TagRef & { recipeCount: number };
