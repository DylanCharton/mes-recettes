import { describe, expect, it } from 'vitest';
import { extractUrl } from './url';

describe('extractUrl', () => {
  it.each([
    [
      'https://jow.fr/fr/recipes/x-89y06dxjhfua0twu16x5',
      'https://jow.fr/fr/recipes/x-89y06dxjhfua0twu16x5',
    ],
    ['Découvre cette recette sur Jow ! https://jow.fr/recipes/abc.', 'https://jow.fr/recipes/abc'],
    ['« Poulet » (https://jow.fr/recipes/abc) à tester', 'https://jow.fr/recipes/abc'],
    ['Deux liens : http://a.fr/1 et https://b.fr/2', 'http://a.fr/1'],
    ['pas de lien', null],
  ])('%s', (text, expected) => {
    expect(extractUrl(text)).toBe(expected);
  });
});
