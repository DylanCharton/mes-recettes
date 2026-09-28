import type { RecipeStatus } from '@mes-recettes/shared';

/** 15 → « 15 min », 75 → « 1 h 15 », 120 → « 2 h ». */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Facile',
  2: 'Moyen',
  3: 'Difficile',
};

export const STATUS_LABELS: Record<RecipeStatus, string> = {
  to_try: 'À tester',
  validated: 'Validée',
  archived: 'Archivée',
};
