import { parse } from 'node-html-parser';

/**
 * Convertit un texte importé en texte brut sûr : balises retirées, entités décodées,
 * espaces fusionnés, longueur bornée (spec § 18.1 — aucun HTML distant n'est jamais rendu).
 */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = parse(`<div>${String(value)}</div>`)
    .textContent.replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
