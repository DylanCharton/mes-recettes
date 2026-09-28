import { suggestSeasons, type ImportSuggestions } from '@mes-recettes/shared';

/** « Indienne » → « indien », « Japonaise » → « japonais », « Mexicaine » → « mexicain ». */
export function cuisineTag(cuisine: string): string {
  const word = cuisine.trim().toLocaleLowerCase('fr');
  return word
    .replace(/ienne$/, 'ien')
    .replace(/aise$/, 'ais')
    .replace(/aine$/, 'ain')
    .replace(/ise$/, 'is');
}

type SuggestionInput = {
  cuisine?: string | null;
  totalMinutes?: number | null;
  vegetarian?: boolean;
  vegan?: boolean;
  keywords: readonly string[];
};

/**
 * Tags et saisons proposés à l'écran de validation, non cochés (spec F8 / F8b). Les mots-clés
 * SEO de la source (« enfant, viandard… ») ne deviennent jamais des tags : trop bruités.
 */
export function buildSuggestions(input: SuggestionInput): ImportSuggestions {
  const tags = new Set<string>();
  if (input.cuisine) tags.add(cuisineTag(input.cuisine));
  if (input.totalMinutes != null && input.totalMinutes <= 30) tags.add('rapide');
  if (input.vegan) tags.add('vegan');
  else if (input.vegetarian) tags.add('végétarien');

  return { tags: [...tags], seasons: suggestSeasons(input.keywords) };
}
