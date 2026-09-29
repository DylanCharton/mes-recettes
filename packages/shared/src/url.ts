/**
 * Première URL http(s) d'un texte partagé (« Découvre cette recette sur Jow ! https://… »),
 * sans la ponctuation finale. Utilisé par la cible de partage et par l'API d'import.
 */
export function extractUrl(text: string): string | null {
  const match = /https?:\/\/[^\s<>"'«»]+/i.exec(text);
  return match ? match[0].replace(/[).,;:!?]+$/, '') : null;
}
