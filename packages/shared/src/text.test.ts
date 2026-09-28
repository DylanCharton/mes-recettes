import { describe, expect, it } from 'vitest';
import { normalizeText } from './text';

describe('normalizeText', () => {
  it('retire accents et majuscules', () => {
    expect(normalizeText('Crème Brûlée')).toBe('creme brulee');
  });

  it('fusionne et coupe les espaces', () => {
    expect(normalizeText('  Poulet   (escalope) ')).toBe('poulet (escalope)');
  });
});
