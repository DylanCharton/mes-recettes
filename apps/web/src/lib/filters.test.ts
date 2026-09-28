import { describe, expect, it } from 'vitest';
import { activeFilterCount, EMPTY_FILTERS, filtersToParams, readFilters } from './filters';

describe('filtres de la bibliothèque', () => {
  it('lit et réécrit les paramètres d’URL sans perte', () => {
    const params = new URLSearchParams(
      'q=poulet&tags=3,7&favorite=1&status=to_try&seasons=autumn,winter&maxTime=30&source=jow&ingredient=riz&sort=time',
    );
    const filters = readFilters(params);
    expect(filters).toEqual({
      q: 'poulet',
      tags: [3, 7],
      favorite: true,
      status: ['to_try'],
      seasons: ['autumn', 'winter'],
      maxTime: 30,
      source: 'jow',
      ingredient: 'riz',
      sort: 'time',
    });
    expect(new URLSearchParams(filtersToParams(filters)).toString()).toBe(params.toString());
    expect(activeFilterCount(filters)).toBe(9);
  });

  it('ignore les valeurs invalides et n’écrit rien pour les filtres vides', () => {
    expect(
      readFilters(new URLSearchParams('seasons=mousson,summer&tags=abc&sort=x&maxTime=-4')),
    ).toEqual({
      ...EMPTY_FILTERS,
      seasons: ['summer'],
    });
    expect(filtersToParams(EMPTY_FILTERS)).toEqual({});
  });
});
