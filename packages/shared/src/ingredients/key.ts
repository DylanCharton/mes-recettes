import { normalizeText } from '../text';

/**
 * Clé de rapprochement d'un ingrédient canonique (spec § 16.4) : sans accents, sans ponctuation,
 * « s » / « x » final retiré de chaque mot. La clé n'est jamais affichée : un faux singulier
 * (« ananas » → « anana ») est sans conséquence puisque toutes les formes donnent la même clé.
 *
 * Les parenthèses sont retirées pour les lignes saisies (« tomates (bien mûres) » → « tomate »)
 * mais conservées pour les ingrédients structurés d'une source (Jow : « Curry (poudre) »).
 */
export function ingredientKey(name: string, options: { keepParentheses?: boolean } = {}): string {
  let text = normalizeText(name);
  if (!options.keepParentheses) text = text.replace(/\([^)]*\)/g, ' ');

  return text
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length > 2 ? word.replace(/[sx]$/, '') : word))
    .join(' ');
}

/** Nom d'affichage d'un nouvel ingrédient canonique : sans parenthèses, majuscule initiale. */
export function ingredientDisplayName(name: string, options: { keepParentheses?: boolean } = {}) {
  const base = options.keepParentheses ? name : name.replace(/\([^)]*\)/g, ' ');
  const text = base.replace(/\s+/g, ' ').trim() || name.trim();
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);
}
