import { describe, expect, it } from 'vitest';
import { parseIngredientLine } from './parseLine';

describe('parseIngredientLine', () => {
  it.each([
    // Tableau de la spec § 16.3
    ['2 carottes', 2, 'piece', 'carottes'],
    ['200 g de carottes', 200, 'g', 'carottes'],
    ['1 courgette', 1, 'piece', 'courgette'],
    ["huile d'olive", null, null, "huile d'olive"],
    ["1 c. à soupe d'huile d'olive", 1, 'tbsp', "huile d'olive"],
    ['1/4 càc Curry (poudre)', 0.25, 'tsp', 'Curry (poudre)'],
    ['0,5 kg de pommes de terre', 500, 'g', 'pommes de terre'],
    ['20 cl de crème liquide', 200, 'ml', 'crème liquide'],
    ['½ bouquet de coriandre', 0.5, 'bunch', 'coriandre'],
    ["2 à 3 gousses d'ail", 2, 'clove', 'ail'],
    ['Sel, poivre', null, null, 'Sel, poivre'],
    // Cas complémentaires
    ['2 càs Lait de coco', 2, 'tbsp', 'Lait de coco'],
    ['1 cuillère à café de cumin', 1, 'tsp', 'cumin'],
    ['3 cuillères à soupe de miel', 3, 'tbsp', 'miel'],
    ['70 g Riz', 70, 'g', 'Riz'],
    ['1,5 l de bouillon', 1500, 'ml', 'bouillon'],
    ['1 1/2 tasse de farine', 1.5, 'piece', 'tasse de farine'],
    ['1½ oignon', 1.5, 'piece', 'oignon'],
    ['2-3 tomates', 2, 'piece', 'tomates'],
    ['une pincée de sel', 1, 'pinch', 'sel'],
    ['1 boîte de tomates concassées', 1, 'can', 'tomates concassées'],
    ['4 tranches de jambon', 4, 'slice', 'jambon'],
    ['2 feuilles de laurier', 2, 'leaf', 'laurier'],
    ['1 sachet de levure', 1, 'pack', 'levure'],
    ['250 GR de beurre', 250, 'g', 'beurre'],
    ['- 2 oeufs', 2, 'piece', 'oeufs'],
    ['• 100 ml de lait', 100, 'ml', 'lait'],
    ['1 bou. Persil', 1, 'bunch', 'Persil'],
    ['500 mg de sel', 0.5, 'g', 'sel'],
  ])('%s', (line, quantity, unit, name) => {
    expect(parseIngredientLine(line)).toMatchObject({ quantity, unit, name });
  });

  it("ne confond pas un nom commençant comme une unité avec l'unité", () => {
    expect(parseIngredientLine('2 clous de girofle')).toMatchObject({
      unit: 'piece',
      name: 'clous de girofle',
    });
    expect(parseIngredientLine('2 gros oignons')).toMatchObject({
      unit: 'piece',
      name: 'gros oignons',
    });
    expect(parseIngredientLine('3 lardons')).toMatchObject({ unit: 'piece', name: 'lardons' });
    expect(parseIngredientLine('1 casserole')).toMatchObject({ unit: 'piece', name: 'casserole' });
    expect(parseIngredientLine('2 courgettes')).toMatchObject({
      unit: 'piece',
      name: 'courgettes',
    });
  });

  it('détecte les ingrédients facultatifs sans modifier le nom', () => {
    expect(parseIngredientLine('1 bouquet de coriandre (facultatif)')).toMatchObject({
      isOptional: true,
      name: 'coriandre (facultatif)',
    });
    expect(parseIngredientLine('piment selon votre goût').isOptional).toBe(true);
    expect(parseIngredientLine('2 carottes').isOptional).toBe(false);
  });

  it('garde la ligne brute quand il ne reste pas de nom', () => {
    expect(parseIngredientLine('2 kg')).toEqual({
      quantity: null,
      unit: null,
      name: '2 kg',
      isOptional: false,
    });
  });

  it('normalise les espaces', () => {
    expect(parseIngredientLine('  1   Poulet (escalope) ')).toMatchObject({
      quantity: 1,
      unit: 'piece',
      name: 'Poulet (escalope)',
    });
  });
});
