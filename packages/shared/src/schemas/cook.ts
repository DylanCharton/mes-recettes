import { z } from 'zod';

/** « Je l'ai faite ! » ; sans date, c'est maintenant (une date passée permet un oubli). */
export const CookCreateSchema = z.object({
  cookedAt: z.iso.datetime({ offset: true }).optional(),
});
export type CookCreate = z.input<typeof CookCreateSchema>;

/** Une réalisation, avec ce qu'il faut pour l'afficher sur la frise. */
export type CookEntry = {
  id: number;
  recipeId: number;
  cookedAt: string;
  title: string;
  imageUrl: string | null;
};

export type CookList = { items: CookEntry[] };
