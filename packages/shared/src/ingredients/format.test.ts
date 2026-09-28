import { describe, expect, it } from 'vitest';
import { scaleQuantity, servingsFactor } from '../scaling';
import { formatIngredientLine, formatQuantity } from './format';

describe('formatQuantity', () => {
  it.each([
    [70, 'g', '70 g'],
    [210, 'g', '210 g'],
    [212, 'g', '210 g'],
    [37.4, 'g', '37 g'],
    [2.54, 'g', '2,5 g'],
    [1500, 'g', '1,5 kg'],
    [1000, 'ml', '1 l'],
    [0.5, 'bunch', '½ bouquet'],
    [2, 'bunch', '2 bouquets'],
    [1.5, 'bunch', '1½ bouquet'],
    [0.25, 'tsp', '¼ c. à café'],
    [1.5, 'piece', '1½'],
    [2, 'piece', '2'],
    [1 / 3, 'piece', '⅓'],
    [0.98, 'piece', '1'],
    [1.4, 'piece', '1,4'],
    [3, 'bou.', '3 bou.'],
  ])('%d %s → %s', (quantity, unit, expected) => {
    expect(formatQuantity(quantity, unit)).toBe(expected);
  });
});

describe('scaleQuantity', () => {
  it('recalcule proportionnellement', () => {
    expect(scaleQuantity(70, 1, 3)).toBe(210);
    expect(scaleQuantity(200, 4, 2)).toBe(100);
    expect(servingsFactor(0, 4)).toBe(1);
  });
});

describe('formatIngredientLine', () => {
  const rice = { quantity: 70, unit: 'g', name: 'Riz', originalText: '70 g Riz' };
  const salt = { quantity: null, unit: null, name: 'Sel, poivre', originalText: 'Sel, poivre' };

  it('affiche le texte original au facteur 1', () => {
    expect(formatIngredientLine(rice, 1)).toBe('70 g Riz');
  });

  it('recalcule la quantité (CA-F4 : 1 → 3 portions)', () => {
    expect(formatIngredientLine(rice, 3)).toBe('210 g Riz');
  });

  it('ne recalcule jamais une ligne sans quantité', () => {
    expect(formatIngredientLine(salt, 2)).toBe('Sel, poivre');
  });

  it('affiche les fractions pour les pièces', () => {
    const onion = { quantity: 1, unit: 'piece', name: 'oignon', originalText: '1 oignon' };
    expect(formatIngredientLine(onion, 0.5)).toBe('½ oignon');
  });
});
