import { matchUnit, type Unit } from './units';

export type ParsedIngredient = {
  quantity: number | null;
  unit: Unit | null;
  name: string;
  isOptional: boolean;
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
};

// Un nombre : « 1 1/2 », « 1½ », « 1/2 », « 1,5 », « 2 », « ½ », « un », « une ».
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\s*[½¼¾⅓⅔⅛]|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛]|une?(?=\s))`;
// Plage éventuelle : « 2-3 », « 2 à 3 » (seule la première valeur est retenue).
const QUANTITY_REGEX = new RegExp(String.raw`^(${NUMBER})(?:\s*(?:-|–|à|a)\s*${NUMBER})?\s*`, 'iu');
const CONNECTOR_REGEX = /^(?:de\s+|d['’]\s*|du\s+|des\s+)/iu;
const BULLET_REGEX = /^[-•*·]\s*/u;
const OPTIONAL_REGEX = /facultati(?:f|ve)|optionnel|selon (?:votre |vos )?go[uû]ts?|\(option\)/iu;

function parseNumber(raw: string): number {
  const text = raw.trim().toLowerCase();
  if (text === 'un' || text === 'une') return 1;

  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(text);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const withUnicode = /^(\d*)\s*([½¼¾⅓⅔⅛])$/u.exec(text);
  if (withUnicode) return Number(withUnicode[1] || 0) + (UNICODE_FRACTIONS[withUnicode[2]!] ?? 0);

  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  return Number(text.replace(',', '.'));
}

/** Supprime le bruit flottant (0.07 × 1000 = 70.00000000000001). */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Analyse pragmatique d'une ligne d'ingrédient (spec § 16.3).
 * Ne modifie jamais le texte original : l'appelant le conserve à part.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const text = line.replace(/\s+/g, ' ').trim().replace(BULLET_REGEX, '');
  const isOptional = OPTIONAL_REGEX.test(text);

  const quantityMatch = QUANTITY_REGEX.exec(text);
  const quantityValue = quantityMatch ? parseNumber(quantityMatch[1]!) : NaN;

  if (!quantityMatch || !Number.isFinite(quantityValue) || quantityValue <= 0) {
    return { quantity: null, unit: null, name: text, isOptional };
  }

  let rest = text.slice(quantityMatch[0].length);
  let unit: Unit = 'piece';
  let factor = 1;

  const unitMatch = matchUnit(rest);
  if (unitMatch) {
    unit = unitMatch.unit;
    factor = unitMatch.factor;
    rest = rest.slice(unitMatch.length).trimStart();
  }

  const name = rest.replace(CONNECTOR_REGEX, '').trim();
  if (!name) {
    // « 2 » seul : rien d'exploitable, on garde la ligne brute.
    return { quantity: null, unit: null, name: text, isOptional };
  }

  return { quantity: round(quantityValue * factor), unit, name, isOptional };
}
