import { describe, expect, it } from 'vitest';
import { ingredientDisplayName, ingredientKey } from './key';

describe('ingredientKey', () => {
  it('rapproche singulier, pluriel, casse et accents', () => {
    expect(ingredientKey('Carottes')).toBe('carotte');
    expect(ingredientKey('carotte')).toBe('carotte');
    expect(ingredientKey('Crème fraîche')).toBe(ingredientKey('creme fraiches'));
    expect(ingredientKey('Choux')).toBe('chou');
  });

  it('remplace la ponctuation par des espaces', () => {
    expect(ingredientKey("Huile d'olive")).toBe('huile d olive');
    expect(ingredientKey('huile d’olive')).toBe('huile d olive');
  });

  it('retire les parenthèses des lignes saisies, les garde pour les sources structurées', () => {
    expect(ingredientKey('tomates (bien mûres)')).toBe('tomate');
    expect(ingredientKey('Curry (poudre)', { keepParentheses: true })).toBe('curry poudre');
    expect(ingredientKey('Curry (pâte)', { keepParentheses: true })).not.toBe(
      ingredientKey('Curry (poudre)', { keepParentheses: true }),
    );
  });

  it('ne touche pas aux mots courts', () => {
    expect(ingredientKey('riz')).toBe('riz');
    expect(ingredientKey('pois')).toBe(ingredientKey('poi'));
  });
});

describe('ingredientDisplayName', () => {
  it('capitalise et retire les parenthèses', () => {
    expect(ingredientDisplayName('tomates (bien mûres)')).toBe('Tomates');
    expect(ingredientDisplayName('Curry (poudre)', { keepParentheses: true })).toBe(
      'Curry (poudre)',
    );
  });
});
