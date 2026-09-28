import {
  RECIPE_SORTS,
  RECIPE_SOURCES,
  RECIPE_STATUSES,
  SEASONS,
  type RecipeSort,
  type RecipeSource,
  type RecipeStatus,
  type Season,
} from '@mes-recettes/shared';

/** Filtres de la bibliothèque, reflétés dans l'URL (`/recipes?q=poulet&maxTime=30`). */
export type Filters = {
  q: string;
  tags: number[];
  favorite: boolean;
  status: RecipeStatus[];
  seasons: Season[];
  maxTime: number | null;
  source: RecipeSource | null;
  ingredient: string;
  sort: RecipeSort;
};

export const EMPTY_FILTERS: Filters = {
  q: '',
  tags: [],
  favorite: false,
  status: [],
  seasons: [],
  maxTime: null,
  source: null,
  ingredient: '',
  sort: 'recent',
};

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const oneOf = <T extends string>(values: readonly T[], value: string | null): value is T =>
  value !== null && (values as readonly string[]).includes(value);

export function readFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort');
  const source = params.get('source');
  const maxTime = Number(params.get('maxTime'));
  return {
    q: params.get('q') ?? '',
    tags: list(params.get('tags'))
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0),
    favorite: params.get('favorite') === '1',
    status: list(params.get('status')).filter((s): s is RecipeStatus => oneOf(RECIPE_STATUSES, s)),
    seasons: list(params.get('seasons')).filter((s): s is Season => oneOf(SEASONS, s)),
    maxTime: Number.isInteger(maxTime) && maxTime > 0 ? maxTime : null,
    source: oneOf(RECIPE_SOURCES, source) ? source : null,
    ingredient: params.get('ingredient') ?? '',
    sort: oneOf(RECIPE_SORTS, sort) ? sort : 'recent',
  };
}

/** Paramètres d'URL et de requête API : seules les valeurs non vides sont écrites. */
export function filtersToParams(filters: Filters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.tags.length) params.tags = filters.tags.join(',');
  if (filters.favorite) params.favorite = '1';
  if (filters.status.length) params.status = filters.status.join(',');
  if (filters.seasons.length) params.seasons = filters.seasons.join(',');
  if (filters.maxTime) params.maxTime = String(filters.maxTime);
  if (filters.source) params.source = filters.source;
  if (filters.ingredient.trim()) params.ingredient = filters.ingredient.trim();
  if (filters.sort !== 'recent') params.sort = filters.sort;
  return params;
}

/** Nombre de filtres actifs hors recherche texte et tri (pastille du bouton « Filtres »). */
export function activeFilterCount(filters: Filters): number {
  return (
    filters.tags.length +
    Number(filters.favorite) +
    filters.status.length +
    filters.seasons.length +
    Number(filters.maxTime !== null) +
    Number(filters.source !== null) +
    Number(filters.ingredient.trim() !== '')
  );
}

export const toggle = <T>(values: readonly T[], value: T): T[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
