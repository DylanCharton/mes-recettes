import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { currentSeason, SEASON_LABELS } from '@mes-recettes/shared';
import { useRecipes } from '../api/recipes';
import { useTags } from '../api/tags';
import { Chip } from '../components/Chip';
import { FilterSheet } from '../components/FilterSheet';
import { LoadError, Loading } from '../components/QueryStatus';
import { RecipeCard } from '../components/RecipeCard';
import { SEASON_ICONS } from '../components/SeasonPicker';
import { primaryButtonClass } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  filtersToParams,
  readFilters,
  toggle,
  type Filters,
} from '../lib/filters';

export function RecipesPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebounce(search, 200);
  const [sheetOpen, setSheetOpen] = useState(false);

  // L'URL est la source de vérité : historique, retour arrière et partage cohérents.
  const setFilters = (next: Filters) => setParams(filtersToParams(next), { replace: true });

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ ...filters, q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la frappe déclenche la mise à jour
  }, [debouncedSearch]);

  const recipes = useRecipes(filters);
  const topTags = (useTags().data ?? [])
    .filter((tag) => tag.recipeCount > 0)
    .sort((a, b) => b.recipeCount - a.recipeCount)
    .slice(0, 5);
  useScrollRestoration(recipes.isSuccess);

  const season = currentSeason();
  const SeasonIcon = SEASON_ICONS[season];
  const inSeason = filters.seasons.length === 1 && filters.seasons[0] === season;
  const filterCount = activeFilterCount(filters);
  const isFiltered = filterCount > 0 || filters.q.trim() !== '';

  return (
    <section>
      <div className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 pt-1 pb-2 backdrop-blur dark:bg-zinc-900/95">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher une recette</span>
            <Search
              size={18}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              enterKeyHint="search"
              className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pr-10 pl-10 text-base outline-none focus:border-accent dark:border-zinc-700 dark:bg-zinc-800"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center text-zinc-400"
                aria-label="Effacer la recherche"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700"
            aria-label={`Filtres${filterCount ? ` (${filterCount} actifs)` : ''}`}
          >
            <SlidersHorizontal size={18} />
            {filterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs text-white">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip
            active={filters.favorite}
            onClick={() => setFilters({ ...filters, favorite: !filters.favorite })}
          >
            ★ Favoris
          </Chip>
          <Chip
            active={inSeason}
            onClick={() => setFilters({ ...filters, seasons: inSeason ? [] : [season] })}
            label={`De saison (${SEASON_LABELS[season]})`}
          >
            <SeasonIcon size={15} aria-hidden /> De saison
          </Chip>
          <Chip
            active={filters.maxTime === 30}
            onClick={() => setFilters({ ...filters, maxTime: filters.maxTime === 30 ? null : 30 })}
          >
            ≤ 30 min
          </Chip>
          <Chip
            active={filters.status.includes('to_try')}
            onClick={() => setFilters({ ...filters, status: toggle(filters.status, 'to_try') })}
          >
            À tester
          </Chip>
          {topTags.map((tag) => (
            <Chip
              key={tag.id}
              active={filters.tags.includes(tag.id)}
              onClick={() => setFilters({ ...filters, tags: toggle(filters.tags, tag.id) })}
            >
              {tag.name}
            </Chip>
          ))}
        </div>
      </div>

      {recipes.isPending && <Loading />}
      {recipes.isError && <LoadError error={recipes.error} onRetry={() => recipes.refetch()} />}

      {recipes.isSuccess && recipes.data.items.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          {isFiltered ? (
            <>
              <p className="text-zinc-600 dark:text-zinc-300">Aucune recette ne correspond.</p>
              <button
                type="button"
                className="text-accent underline"
                onClick={() => {
                  setSearch('');
                  setFilters(EMPTY_FILTERS);
                }}
              >
                Effacer les filtres
              </button>
            </>
          ) : (
            <>
              <p className="text-zinc-600 dark:text-zinc-300">Aucune recette pour l’instant.</p>
              <Link to="/import" className={primaryButtonClass}>
                Importer une recette
              </Link>
            </>
          )}
        </div>
      )}

      {recipes.isSuccess && recipes.data.items.length > 0 && (
        <>
          {isFiltered && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {recipes.data.total} recette{recipes.data.total > 1 ? 's' : ''}
            </p>
          )}
          <ul
            className={`mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${recipes.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {recipes.data.items.map((recipe) => (
              <li key={recipe.id} className="flex">
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        to="/recipes/new"
        aria-label="Nouvelle recette"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] inline-flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <Plus size={26} />
      </Link>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        total={recipes.data?.total}
      />
    </section>
  );
}
