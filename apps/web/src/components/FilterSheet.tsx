import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { RecipeSort, RecipeStatus } from '@mes-recettes/shared';
import { useIngredientSuggestions } from '../api/recipes';
import { useTags } from '../api/tags';
import { useDebounce } from '../hooks/useDebounce';
import { EMPTY_FILTERS, toggle, type Filters } from '../lib/filters';
import { STATUS_LABELS } from '../lib/format';
import { Chip } from './Chip';
import { SeasonPicker } from './SeasonPicker';
import { Sheet } from './Sheet';
import { inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

const SORT_LABELS: Record<RecipeSort, string> = {
  recent: 'Plus récentes',
  title: 'Titre (A→Z)',
  time: 'Plus rapides',
  updated: 'Modifiées récemment',
};

const MAX_TIMES = [15, 30, 45, 60];

type Props = {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (filters: Filters) => void;
  total: number | undefined;
};

/** Filtres avancés : appliqués immédiatement, la liste se met à jour derrière la feuille. */
export function FilterSheet({ open, onClose, filters, onChange, total }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const tags = useTags().data ?? [];
  const ingredientListId = useId();
  const ingredientQuery = useDebounce(filters.ingredient, 200);
  const ingredients = useIngredientSuggestions(ingredientQuery).data ?? [];

  return (
    <Sheet open={open} title="Filtres" onClose={onClose}>
      <Section title="Trier par">
        {(Object.keys(SORT_LABELS) as RecipeSort[]).map((sort) => (
          <Chip key={sort} active={filters.sort === sort} onClick={() => set({ sort })}>
            {SORT_LABELS[sort]}
          </Chip>
        ))}
      </Section>

      <Section title="Saisons">
        <SeasonPicker
          value={filters.seasons}
          onChange={(seasons) => set({ seasons })}
          allYear={false}
        />
      </Section>

      <Section title="Temps total maximal">
        {MAX_TIMES.map((minutes) => (
          <Chip
            key={minutes}
            active={filters.maxTime === minutes}
            onClick={() => set({ maxTime: filters.maxTime === minutes ? null : minutes })}
          >
            ≤ {minutes} min
          </Chip>
        ))}
      </Section>

      <Section title="Statut">
        <Chip active={filters.favorite} onClick={() => set({ favorite: !filters.favorite })}>
          ★ Favoris
        </Chip>
        {(Object.keys(STATUS_LABELS) as RecipeStatus[]).map((status) => (
          <Chip
            key={status}
            active={filters.status.includes(status)}
            onClick={() => set({ status: toggle(filters.status, status) })}
          >
            {STATUS_LABELS[status]}
          </Chip>
        ))}
      </Section>

      <Section title="Source">
        <Chip active={filters.source === null} onClick={() => set({ source: null })}>
          Toutes
        </Chip>
        <Chip active={filters.source === 'jow'} onClick={() => set({ source: 'jow' })}>
          Jow
        </Chip>
        <Chip active={filters.source === 'manual'} onClick={() => set({ source: 'manual' })}>
          Saisies à la main
        </Chip>
      </Section>

      <div>
        <label htmlFor="ingredient-filter" className="mb-2 block text-sm font-medium">
          Contient l’ingrédient
        </label>
        <input
          id="ingredient-filter"
          value={filters.ingredient}
          onChange={(e) => set({ ingredient: e.target.value })}
          list={ingredientListId}
          placeholder="poulet, courgette…"
          className={inputClass}
        />
        <datalist id={ingredientListId}>
          {ingredients.map((ingredient) => (
            <option key={ingredient.id} value={ingredient.name} />
          ))}
        </datalist>
      </div>

      {tags.length > 0 && (
        <Section
          title="Tags"
          action={
            <Link to="/tags" className="text-sm text-accent underline">
              Gérer
            </Link>
          }
        >
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              active={filters.tags.includes(tag.id)}
              onClick={() => set({ tags: toggle(filters.tags, tag.id) })}
            >
              {tag.name} <span className="opacity-60">{tag.recipeCount}</span>
            </Chip>
          ))}
        </Section>
      )}

      <div className="sticky bottom-0 flex gap-2 bg-white pt-2 dark:bg-zinc-900">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q })}
        >
          Réinitialiser
        </button>
        <button type="button" className={`${primaryButtonClass} flex-1`} onClick={onClose}>
          {total === undefined
            ? 'Voir les recettes'
            : `Voir ${total} recette${total > 1 ? 's' : ''}`}
        </button>
      </div>
    </Sheet>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
