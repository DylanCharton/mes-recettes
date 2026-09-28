import { ImagePlus, Loader2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  formatQuantity,
  parseIngredientLine,
  type RecipeDetail,
  type RecipeInput,
} from '@mes-recettes/shared';
import { ApiError, errorMessage } from '../api/client';
import { uploadImage } from '../api/recipes';
import { resizeImage } from '../lib/resizeImage';
import { inputClass, labelClass, primaryButtonClass } from './ui';

type FormState = {
  title: string;
  description: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  totalMinutes: string;
  ingredientsText: string;
  stepsText: string;
  toolsText: string;
  notes: string;
  imagePath: string | null;
  imageUrl: string | null;
};

const toText = (value: number | null) => (value === null ? '' : String(value));
const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));
const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function initialState(recipe?: RecipeDetail): FormState {
  return {
    title: recipe?.title ?? '',
    description: recipe?.description ?? '',
    servings: String(recipe?.servings ?? 2),
    prepMinutes: toText(recipe?.prepMinutes ?? null),
    cookMinutes: toText(recipe?.cookMinutes ?? null),
    totalMinutes: toText(recipe?.totalMinutes ?? null),
    ingredientsText: recipe?.ingredients.map((line) => line.originalText).join('\n') ?? '',
    stepsText: recipe?.steps.map((step) => step.text).join('\n') ?? '',
    toolsText: recipe?.tools.join(', ') ?? '',
    notes: recipe?.notes ?? '',
    imagePath: recipe?.imagePath ?? null,
    imageUrl: recipe?.imageUrl ?? null,
  };
}

function toInput(state: FormState): RecipeInput {
  return {
    title: state.title,
    description: state.description,
    servings: Number(state.servings),
    prepMinutes: toNumber(state.prepMinutes),
    cookMinutes: toNumber(state.cookMinutes),
    totalMinutes: toNumber(state.totalMinutes),
    ingredients: lines(state.ingredientsText).map((text) => ({ text })),
    steps: lines(state.stepsText),
    tools: state.toolsText
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean),
    notes: state.notes,
    imagePath: state.imagePath,
  };
}

type Props = {
  recipe?: RecipeDetail;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<unknown>;
};

export function RecipeForm({ recipe, submitLabel, onSubmit }: Props) {
  const [state, setState] = useState(() => initialState(recipe));
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ message: string; fields: string[] } | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const imagePath = await uploadImage(await resizeImage(file));
      setState((current) => ({ ...current, imagePath, imageUrl: `/images/${imagePath}` }));
    } catch (err) {
      setError({ message: errorMessage(err), fields: [] });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(toInput(state));
    } catch (err) {
      const fields =
        err instanceof ApiError && Array.isArray(err.details)
          ? (err.details as { path: string; message: string }[]).map(
              (d) => `${d.path} : ${d.message}`,
            )
          : [];
      setError({ message: errorMessage(err), fields });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-24">
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-medium">{error.message}</p>
          {error.fields.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {error.fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <PhotoField
        imageUrl={state.imageUrl}
        uploading={uploading}
        onPick={handlePhoto}
        onRemove={() => setState((current) => ({ ...current, imagePath: null, imageUrl: null }))}
      />

      <Field label="Titre" htmlFor="title">
        <input
          id="title"
          required
          maxLength={200}
          value={state.title}
          onChange={(e) => set('title', e.target.value)}
          className={inputClass}
          enterKeyHint="next"
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <textarea
          id="description"
          rows={2}
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          id="servings"
          label="Portions"
          value={state.servings}
          min={1}
          required
          onChange={(v) => set('servings', v)}
        />
        <NumberField
          id="prepMinutes"
          label="Prépa. (min)"
          value={state.prepMinutes}
          onChange={(v) => set('prepMinutes', v)}
        />
        <NumberField
          id="cookMinutes"
          label="Cuisson (min)"
          value={state.cookMinutes}
          onChange={(v) => set('cookMinutes', v)}
        />
        <NumberField
          id="totalMinutes"
          label="Total (min)"
          value={state.totalMinutes}
          onChange={(v) => set('totalMinutes', v)}
          placeholder="auto"
        />
      </div>

      <Field
        label="Ingrédients"
        htmlFor="ingredients"
        hint="Un ingrédient par ligne, par ex. « 200 g de carottes »."
      >
        <textarea
          id="ingredients"
          rows={6}
          value={state.ingredientsText}
          onChange={(e) => set('ingredientsText', e.target.value)}
          className={inputClass}
        />
        <IngredientPreview text={state.ingredientsText} />
      </Field>

      <Field label="Étapes" htmlFor="steps" hint="Une étape par ligne.">
        <textarea
          id="steps"
          rows={6}
          value={state.stepsText}
          onChange={(e) => set('stepsText', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Ustensiles" htmlFor="tools" hint="Séparés par des virgules.">
        <input
          id="tools"
          value={state.toolsText}
          onChange={(e) => set('toolsText', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Notes personnelles" htmlFor="notes">
        <textarea
          id="notes"
          rows={3}
          value={state.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto max-w-5xl">
          <button
            type="submit"
            disabled={submitting || uploading}
            className={`${primaryButtonClass} w-full`}
          >
            {submitting && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field(props: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={props.htmlFor} className={labelClass}>
        {props.label}
      </label>
      {props.children}
      {props.hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{props.hint}</p>}
    </div>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className={labelClass}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="number"
        inputMode="numeric"
        min={props.min ?? 0}
        required={props.required}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

function IngredientPreview({ text }: { text: string }) {
  const parsed = useMemo(
    () => lines(text).map((line) => ({ line, ...parseIngredientLine(line) })),
    [text],
  );
  if (parsed.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm" aria-label="Analyse des ingrédients">
      {parsed.map(({ line, quantity, unit, name }, index) => (
        <li key={`${index}-${line}`} className="flex gap-2">
          <span className="w-24 shrink-0 text-right font-medium tabular-nums text-accent">
            {quantity === null ? '—' : formatQuantity(quantity, unit)}
          </span>
          <span className="text-zinc-700 dark:text-zinc-300">{name}</span>
        </li>
      ))}
    </ul>
  );
}

function PhotoField(props: {
  imageUrl: string | null;
  uploading: boolean;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  if (props.imageUrl) {
    return (
      <div className="relative">
        <img src={props.imageUrl} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
        <button
          type="button"
          onClick={props.onRemove}
          className="absolute right-2 top-2 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label="Retirer la photo"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <label className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {props.uploading ? <Loader2 size={28} className="animate-spin" /> : <ImagePlus size={28} />}
      <span className="text-sm">
        {props.uploading ? 'Envoi de la photo…' : 'Ajouter une photo'}
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={props.uploading}
        onChange={(e) => props.onPick(e.target.files?.[0])}
      />
    </label>
  );
}
