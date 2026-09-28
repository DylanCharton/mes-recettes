import {
  Check,
  ChefHat,
  Clock,
  CookingPot,
  ExternalLink,
  Leaf,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  formatIngredientLine,
  formatSeasons,
  RECIPE_STATUSES,
  servingsFactor,
  type RecipeDetail,
  type RecipeIngredient,
  type Season,
} from '@mes-recettes/shared';
import { errorMessage } from '../api/client';
import { useDeleteRecipe, usePatchRecipe, useRecipe } from '../api/recipes';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadError, Loading } from '../components/QueryStatus';
import { SEASON_ICONS, SeasonPicker } from '../components/SeasonPicker';
import { ServingsStepper } from '../components/ServingsStepper';
import { Sheet } from '../components/Sheet';
import {
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';
import { useLocalChecklist } from '../hooks/useLocalChecklist';
import { useWakeLock, wakeLockSupported } from '../hooks/useWakeLock';
import { DIFFICULTY_LABELS, formatMinutes, STATUS_LABELS } from '../lib/format';

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
  const [cooking, setCooking] = useState(false);
  useWakeLock(cooking);
  // En mode cuisine, la première étape non cochée est mise en avant.
  const currentStepId = cooking
    ? recipe.steps.find((step) => !checklist.isChecked('steps', step.id))?.id
    : undefined;

  const mainIngredients = recipe.ingredients.filter((line) => !line.isPantry);
  const pantryIngredients = recipe.ingredients.filter((line) => line.isPantry);

  return (
    <article className={`flex flex-col gap-6 pb-8 ${cooking ? 'text-lg' : ''}`}>
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

        <div className="flex items-start gap-1">
          <h1 className="flex-1 text-2xl leading-tight font-semibold">{recipe.title}</h1>
          <FavoriteButton recipe={recipe} />
          <RecipeMenu recipe={recipe} />
        </div>

        <RecipeMeta recipe={recipe} />
        <TagsAndSeasons recipe={recipe} />
        {recipe.description && (
          <p className="text-zinc-700 dark:text-zinc-300">{recipe.description}</p>
        )}

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setCooking((value) => !value)}
            aria-pressed={cooking}
            className={`${cooking ? primaryButtonClass : secondaryButtonClass} self-start`}
          >
            <CookingPot size={18} aria-hidden />
            {cooking ? 'Quitter le mode cuisine' : 'Mode cuisine'}
          </button>
          {cooking && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {wakeLockSupported
                ? 'L’écran reste allumé. Touchez une étape quand elle est faite.'
                : 'Ce navigateur ne permet pas de garder l’écran allumé.'}
            </p>
          )}
        </div>
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
              const current = step.id === currentStepId;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => checklist.toggle('steps', step.id)}
                    aria-pressed={done}
                    aria-current={current ? 'step' : undefined}
                    className={`flex w-full gap-3 rounded-lg p-3 text-left ${
                      done
                        ? 'text-zinc-400 line-through dark:text-zinc-500'
                        : 'bg-zinc-50 dark:bg-zinc-800/60'
                    } ${current ? 'ring-2 ring-accent' : ''}`}
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

      <NotesEditor recipe={recipe} />

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
  const [editingSeasons, setEditingSeasons] = useState(false);
  const patch = usePatchRecipe(recipe.id);
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
              className={menuItem}
              onClick={() => {
                setOpen(false);
                setEditingSeasons(true);
              }}
            >
              <Leaf size={18} aria-hidden /> Saisons…
            </button>
            <p className="px-4 pt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Statut
            </p>
            {RECIPE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                role="menuitemradio"
                aria-checked={recipe.status === status}
                className={menuItem}
                onClick={() => {
                  setOpen(false);
                  patch.mutate({ status });
                }}
              >
                <Check
                  size={18}
                  aria-hidden
                  className={recipe.status === status ? '' : 'invisible'}
                />
                {STATUS_LABELS[status]}
              </button>
            ))}
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

      <SeasonsSheet
        key={String(editingSeasons)}
        recipe={recipe}
        open={editingSeasons}
        onClose={() => setEditingSeasons(false)}
      />

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

function FavoriteButton({ recipe }: { recipe: RecipeDetail }) {
  const patch = usePatchRecipe(recipe.id);
  return (
    <button
      type="button"
      className={iconButtonClass}
      aria-pressed={recipe.isFavorite}
      aria-label={recipe.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onClick={() => patch.mutate({ isFavorite: !recipe.isFavorite })}
    >
      <Star size={22} className={recipe.isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
    </button>
  );
}

function TagsAndSeasons({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.tags.length === 0 && recipe.seasons.length === 0 && recipe.status === 'validated') {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {recipe.status !== 'validated' && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          {STATUS_LABELS[recipe.status]}
        </span>
      )}
      {recipe.tags.map((tag) => (
        <Link
          key={tag.id}
          to={`/recipes?tags=${tag.id}`}
          className="rounded-full bg-accent/10 px-2.5 py-0.5 text-accent"
        >
          #{tag.name}
        </Link>
      ))}
      {recipe.seasons.length > 0 && (
        <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
          {recipe.seasons.length < 4 &&
            recipe.seasons.map((season) => {
              const Icon = SEASON_ICONS[season];
              return <Icon key={season} size={15} aria-hidden />;
            })}
          {formatSeasons(recipe.seasons)}
        </span>
      )}
    </div>
  );
}

function NotesEditor({ recipe }: { recipe: RecipeDetail }) {
  const patch = usePatchRecipe(recipe.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(recipe.notes ?? '');

  if (!editing) {
    return (
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notes</h2>
          <button
            type="button"
            className="text-sm text-accent underline"
            onClick={() => {
              setText(recipe.notes ?? '');
              setEditing(true);
            }}
          >
            {recipe.notes ? 'Modifier' : 'Ajouter une note'}
          </button>
        </div>
        {recipe.notes && (
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{recipe.notes}</p>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor="inline-notes" className="text-lg font-semibold">
        Notes
      </label>
      <textarea
        id="inline-notes"
        rows={4}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={patch.isPending}
          onClick={() => patch.mutate({ notes: text }, { onSuccess: () => setEditing(false) })}
        >
          Enregistrer
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => setEditing(false)}>
          Annuler
        </button>
      </div>
      {patch.isError && <p className="text-sm text-red-600">{errorMessage(patch.error)}</p>}
    </section>
  );
}

function SeasonsSheet(props: { recipe: RecipeDetail; open: boolean; onClose: () => void }) {
  const patch = usePatchRecipe(props.recipe.id);
  const [seasons, setSeasons] = useState<Season[]>(props.recipe.seasons);
  return (
    <Sheet open={props.open} title="Saisons" onClose={props.onClose}>
      <SeasonPicker value={seasons} onChange={setSeasons} />
      <button
        type="button"
        className={primaryButtonClass}
        disabled={patch.isPending}
        onClick={() => patch.mutate({ seasons }, { onSuccess: props.onClose })}
      >
        Enregistrer
      </button>
    </Sheet>
  );
}
