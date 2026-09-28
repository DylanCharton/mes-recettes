/**
 * Normalise un texte pour la recherche et les clés d'unicité :
 * minuscules, sans accents, espaces fusionnés.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
