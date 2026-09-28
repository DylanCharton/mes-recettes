import { unitLabel } from './units';

const FRACTIONS: [value: number, glyph: string][] = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

function decimal(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

function roundMetric(value: number): number {
  if (value >= 100) return Math.round(value / 5) * 5;
  if (value >= 10) return Math.round(value);
  return Number(value.toFixed(1));
}

function asFraction(value: number): string {
  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < 0.05) return String(whole);
  if (rest > 0.95) return String(whole + 1);

  const match = FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < 0.05);
  if (!match) return decimal(value, 1);
  return whole === 0 ? match[1] : `${whole}${match[1]}`;
}

/**
 * Quantité + unité prêtes à afficher, avec arrondis d'affichage uniquement (spec § 16.5).
 * `formatQuantity(1500, 'g')` → « 1,5 kg » ; `formatQuantity(0.5, 'bunch')` → « ½ bouquet ».
 */
export function formatQuantity(quantity: number, unit: string | null): string {
  if (unit === 'g' || unit === 'ml') {
    if (quantity >= 1000) return `${decimal(quantity / 1000, 2)} ${unit === 'g' ? 'kg' : 'l'}`;
    return `${decimal(roundMetric(quantity), 1)} ${unit}`;
  }
  const label = unitLabel(unit, quantity);
  const value = asFraction(quantity);
  return label ? `${value} ${label}` : value;
}

export type DisplayableIngredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
  originalText: string;
};

/**
 * Libellé d'une ligne pour un facteur de portions donné. Au facteur 1, le texte original
 * est affiché tel quel ; sans quantité (« sel, poivre »), la ligne n'est jamais recalculée.
 */
export function formatIngredientLine(item: DisplayableIngredient, factor: number): string {
  if (item.quantity === null || factor === 1) return item.originalText;
  return `${formatQuantity(item.quantity * factor, item.unit)} ${item.name}`;
}
