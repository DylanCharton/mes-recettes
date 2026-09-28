import { z } from 'zod';
import { normalizeText } from './text';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const SeasonSchema = z.enum(SEASONS);
export type Season = z.infer<typeof SeasonSchema>;

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
};

/** Saisons météorologiques : mars–mai, juin–août, septembre–novembre, décembre–février. */
export function currentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0 = janvier
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

const SEASON_KEYWORDS: Record<Season, RegExp> = {
  spring: /\b(?:printemps|printanier(?:e)?|spring)\b/,
  summer: /\b(?:ete|estival(?:e)?|summer)\b/,
  autumn: /\b(?:automne|automnal(?:e)?|automn|autumn|fall)\b/,
  winter: /\b(?:hiver|hivernal(?:e)?|winter)\b/,
};

/** Saisons évoquées par des mots-clés de la source (spec F8b), jamais appliquées d'office. */
export function suggestSeasons(keywords: readonly string[]): Season[] {
  const text = normalizeText(keywords.join(' , '));
  return SEASONS.filter((season) => SEASON_KEYWORDS[season].test(text));
}

/** « Automne · Hiver », « Toute l'année » (4 saisons) ou chaîne vide (aucune). */
export function formatSeasons(seasons: readonly Season[]): string {
  if (seasons.length === SEASONS.length) return 'Toute l’année';
  return SEASONS.filter((season) => seasons.includes(season))
    .map((season) => SEASON_LABELS[season])
    .join(' · ');
}
