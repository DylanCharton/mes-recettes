import { ChefHat, Clock, ExternalLink, MoreVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  formatIngredientLine,
  servingsFactor,
  type RecipeDetail,
  type RecipeIngredient,
} from '@mes-recettes/shared';
import { errorMessage } from '../api/client';
import { useDeleteRecipe, useRecipe } from '../api/recipes';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadError, Loading } from '../components/QueryStatus';
import { ServingsStepper } from '../components/ServingsStepper';
import { iconButtonClass } from '../components/ui';
import { useLocalChecklist } from '../hooks/useLocalChecklist';
import { DIFFICULTY_LABELS, formatMinutes } from '../lib/format';

export function RecipePage() {
  const id = Number(useParams().id);
  const recipe = useRecipe(id);

  return (
    <section>
      <BackLink to="/recipes" />
      {recipe.isPending && <Loading />}
      {recipe.isError && <LoadError error={recipe.error} onRetry={() => recipe.refetch()} />}
      {recipe.isSuccess && <RecipeView key={recipe.data.id} recipe={recipe.data} />}
    </section>
  );
}

function RecipeView({ recipe }: { recipe: RecipeDetail }) {
  const [servings, setServings] = useState(recipe.servings);
  const checklist = useLocalChecklist(recipe.id);
  const factor = servingsFactor(recipe.servings, servings);

  const mainIngredients = recipe.ingredients.filter((line) => !line.isPantry);
  const pantryIngredients = recipe.ingredients.filter((line) => line.isPantry);

  return (
    <article className="flex flex-col gap-6 pb-8">
      <header className="flex flex-col gap-3">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt=""
            className="aspect-[4/3] w-full rounded-xl object-cover sm:max-h-96"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 sm:max-h-64 dark:bg-zinc-800">
            <ChefHat size={48} aria-hidden />
          </div>
        )}

        <div className="flex items-start gap-2">
          <h1 className="flex-1 text-2xl font-semibold leading-tight">
            {recipe.title}
            {recipe.isFavorite && (
              <Star
                className="ml-2 inline fill-amber-400 text-amber-400"
                size={20}
                aria-label="Favori"
              />
            )}
          </h1>
          <RecipeMenu recipe={recipe} />
        </div>

        <RecipeMeta recipe={recipe} />
        {recipe.description && (
          <p className="text-zinc-700 dark:text-zinc-300">{recipe.description}</p>
        )}
      </header>

      {recipe.ingredients.length > 0 && (
        <section aria-labelledby="ingredients-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="ingredients-title" className="text-lg font-semibold">
              Ingrédients
            </h2>
            <ServingsStepper value={servings} onChange={setServings} />
          </div>
          <IngredientList
            lines={mainIngredients}
            factor={factor}
            isChecked={(id) => checklist.isChecked('ingredients', id)}
            onToggle={(id) => checklist.toggle('ingredients', id)}
          />
          {pantryIngredients.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                À avoir chez soi ({pantryIngredients.length})
              </summary>
              <IngredientList
                lines={pantryIngredients}
                factor={factor}
                isChecked={(id) => checklist.isChecked('ingredients', id)}
                onToggle={(id) => checklist.toggle('ingredients', id)}
              />
            </details>
          )}
        </section>
      )}

      {recipe.tools.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Ustensiles</h2>
          <p className="text-zinc-700 dark:text-zinc-300">{recipe.tools.join(' · ')}</p>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className="mb-3 text-lg font-semibold">
            Étapes
          </h2>
          <ol className="flex flex-col gap-2">
            {recipe.steps.map((step, index) => {
              const done = checklist.isChecked('steps', step.id);
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => checklist.toggle('steps', step.id)}
                    aria-pressed={done}
                    className={`flex w-full gap-3 rounded-lg p-3 text-left ${
                      done
                        ? 'text-zinc-400 line-through dark:text-zinc-500'
                        : 'bg-zinc-50 dark:bg-zinc-800/60'
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {checklist.hasChecks && (
        <button
          type="button"
          onClick={checklist.reset}
          className="self-start text-sm text-accent underline"
        >
          Tout décocher
        </button>
      )}

      {recipe.notes && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{recipe.notes}</p>
        </section>
      )}

      {recipe.nutrition && <NutritionTable nutrition={recipe.nutrition} />}

      <SourceInfo recipe={recipe} />
    </article>
  );
}

function RecipeMeta({ recipe }: { recipe: RecipeDetail }) {
  const details = [
    recipe.prepMinutes !== null && `${formatMinutes(recipe.prepMinutes)} de prépa.`,
    recipe.cookMinutes !== null && `${formatMinutes(recipe.cookMinutes)} de cuisson`,
  ].filter(Boolean);
  const difficulty = recipe.difficulty !== null ? DIFFICULTY_LABELS[recipe.difficulty] : undefined;

  const scores = [
    recipe.nutriScore && `Nutri-Score ${recipe.nutriScore}`,
    recipe.greenScore && `Green-Score ${recipe.greenScore}`,
  ].filter(Boolean);

  if (recipe.totalMinutes === null && !difficulty && scores.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
      {recipe.totalMinutes !== null && (
        <span className="inline-flex items-center gap-1">
          <Clock size={16} aria-hidden />
          <strong className="font-medium">{formatMinutes(recipe.totalMinutes)}</strong>
          {details.length > 0 && <span>({details.join(' · ')})</span>}
        </span>
      )}
      {difficulty && <span>· {difficulty}</span>}
      {scores.map((score) => (
        <span
          key={String(score)}
          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
        >
          {score}
        </span>
      ))}
    </p>
  );
}

const NUTRIENT_LABELS: [keyof NonNullable<RecipeDetail['nutrition']>, string, string][] = [
  ['kcal', 'Énergie', 'kcal'],
  ['protein', 'Protéines', 'g'],
  ['carbs', 'Glucides', 'g'],
  ['fat', 'Lipides', 'g'],
  ['fiber', 'Fibres', 'g'],
  ['sugar', 'Sucres', 'g'],
  ['salt', 'Sel', 'g'],
];

function NutritionTable({ nutrition }: { nutrition: NonNullable<RecipeDetail['nutrition']> }) {
  const rows = NUTRIENT_LABELS.filter(([key]) => nutrition[key] !== undefined);
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Nutrition (par portion)</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        {rows.map(([key, label, unit]) => (
          <div
            key={key}
            className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-800"
          >
            <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
            <dd className="font-medium tabular-nums">
              {nutrition[key]!.toLocaleString('fr-FR')} {unit}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SourceInfo({ recipe }: { recipe: RecipeDetail }) {
  if (!recipe.sourceUrl && !recipe.importedAt) return null;
  const label = recipe.source === 'jow' ? 'Voir sur Jow' : 'Voir la recette d’origine';
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 underline"
        >
          {label} <ExternalLink size={14} aria-hidden />
        </a>
      )}
      {recipe.importedAt && (
        <span>Importée le {new Date(recipe.importedAt).toLocaleDateString('fr-FR')}</span>
      )}
    </p>
  );
}

function IngredientList(props: {
  lines: RecipeIngredient[];
  factor: number;
  isChecked: (id: number) => boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <ul className="flex flex-col">
      {props.lines.map((line) => {
        const checked = props.isChecked(line.id);
        const label = formatIngredientLine(line, props.factor);
        const showOptional = line.isOptional && !/facultati/i.test(label);
        return (
          <li key={line.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => props.onToggle(line.id)}
                className="size-5 shrink-0 accent-[var(--color-accent)]"
              />
              <span className={checked ? 'text-zinc-400 line-through dark:text-zinc-500' : ''}>
                {label}
                {showOptional && (
                  <span className="text-zinc-500 dark:text-zinc-400"> (facultatif)</span>
                )}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function RecipeMenu({ recipe }: { recipe: RecipeDetail }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteRecipe();
  const navigate = useNavigate();

  const menuItem =
    'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700';

  return (
    <div className="relative">
      <button
        type="button"
        className={iconButtonClass}
        aria-label="Actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={22} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5 dark:bg-zinc-800">
            <Link to={`/recipes/${recipe.id}/edit`} className={menuItem}>
              <Pencil size={18} aria-hidden /> Modifier
            </Link>
            <button
              type="button"
              className={`${menuItem} text-red-600`}
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              <Trash2 size={18} aria-hidden /> Supprimer
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title="Supprimer la recette ?"
        message={error ?? `« ${recipe.title} » sera définitivement supprimée, photo comprise.`}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(recipe.id, {
            onSuccess: () => navigate('/recipes', { replace: true }),
            onError: (err) => setError(errorMessage(err)),
          })
        }
      />
    </div>
  );
}
