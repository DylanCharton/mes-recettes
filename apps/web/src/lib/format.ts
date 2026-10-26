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

const DAY_MS = 86_400_000;

/** Minuit local du jour de `date` : base des regroupements par jour (frise). */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Jours calendaires de `from` à `to` (arrondi : un changement d'heure ne décale rien). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

/** « aujourd’hui », « hier », « il y a 5 jours », puis « le 12 mars » (année si différente). */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return `le ${date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(!sameYear && { year: 'numeric' }),
  })}`;
}

/** Durée d'un trou dans la frise : « 1 sem. », « 3 mois », « 2 ans ». */
export function formatGap(days: number): string {
  if (days < 30) return `${Math.max(1, Math.round(days / 7))} sem.`;
  if (days < 365) return `${Math.round(days / 30)} mois`;
  const years = Math.round(days / 365);
  return `${years} an${years > 1 ? 's' : ''}`;
}

/** 1 → « 1ʳᵉ », 3 → « 3ᵉ ». */
export const ordinal = (n: number) => (n === 1 ? '1ʳᵉ' : `${n}ᵉ`);
