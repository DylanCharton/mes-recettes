import { AlertTriangle, ClipboardPaste, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ImportPreviewResponse, PartialImport } from '@mes-recettes/shared';
import { ApiError, errorMessage } from '../api/client';
import { useImportPreview } from '../api/imports';
import { useSaveRecipe } from '../api/recipes';
import { RecipeForm } from '../components/RecipeForm';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/ui';

type Draft = Extract<ImportPreviewResponse, { status: 'ok' }>;

export function ImportPage() {
  const [params, setParams] = useSearchParams();
  const [url, setUrl] = useState(params.get('url') ?? '');
  const [force, setForce] = useState(false);
  const preview = useImportPreview();
  const autoStarted = useRef(false);

  const analyse = (value: string, options: { force?: boolean } = {}) => {
    if (!value.trim()) return;
    setForce(options.force ?? false);
    preview.mutate({ url: value.trim(), force: options.force });
  };

  // Arrivée depuis le partage Android (/share → /import?url=…&auto=1) : analyse sans tap.
  useEffect(() => {
    if (autoStarted.current || params.get('auto') !== '1' || !url) return;
    autoStarted.current = true;
    setParams({ url }, { replace: true });
    analyse(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'arrivée
  }, []);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      analyse(text);
    } catch {
      // Permission refusée : l'utilisateur peut encore coller à la main.
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    analyse(url);
  }

  const result = preview.data;

  if (result?.status === 'ok' && !preview.isPending) {
    return (
      <ImportValidation
        key={result.draft.externalId ?? url}
        result={result}
        force={force}
        onReset={preview.reset}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Importer une recette</h1>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="url" className="text-sm text-zinc-600 dark:text-zinc-300">
          Lien d’une recette Jow
        </label>
        <div className="flex gap-2">
          <input
            id="url"
            type="url"
            inputMode="url"
            enterKeyHint="go"
            placeholder="https://jow.fr/fr/recipes/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={paste}
            className={secondaryButtonClass}
            aria-label="Coller le lien"
          >
            <ClipboardPaste size={18} aria-hidden />
            <span className="hidden sm:inline">Coller</span>
          </button>
        </div>
        <button
          type="submit"
          disabled={!url.trim() || preview.isPending}
          className={primaryButtonClass}
        >
          {preview.isPending && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {preview.isPending ? 'Analyse de la recette…' : 'Analyser'}
        </button>
      </form>

      {result?.status === 'duplicate' && !preview.isPending && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
          {result.existing.imageUrl && (
            <img
              src={result.existing.imageUrl}
              alt=""
              className="size-20 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="flex flex-col gap-2">
            <p className="font-medium">Cette recette existe déjà</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{result.existing.title}</p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/recipes/${result.existing.id}`} className={primaryButtonClass}>
                Ouvrir la recette
              </Link>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => analyse(url, { force: true })}
              >
                Importer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {preview.isError && (
        <ImportError error={preview.error} onRetry={() => analyse(url, { force })} />
      )}

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Astuce : depuis Jow, utilisez <strong>Partager</strong> puis <strong>Mes recettes</strong>{' '}
        une fois l’application installée sur le téléphone.
      </p>
    </section>
  );
}

function ImportError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const navigate = useNavigate();
  const partial =
    error instanceof ApiError && error.code === 'PARSE_FAILED'
      ? (error.details as { partial?: PartialImport } | undefined)?.partial
      : undefined;
  const retryable =
    error instanceof ApiError
      ? ['SOURCE_UNREACHABLE', 'SOURCE_TIMEOUT', 'RATE_LIMITED', 'INTERNAL_ERROR'].includes(
          error.code,
        )
      : true;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl bg-red-50 p-3 text-red-900 dark:bg-red-950/50 dark:text-red-100"
    >
      <p className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        {errorMessage(error)}
      </p>
      <div className="flex flex-wrap gap-2">
        {partial && (
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              navigate('/recipes/new', {
                state: { prefill: { title: partial.title ?? '', sourceUrl: partial.sourceUrl } },
              })
            }
          >
            Créer manuellement
          </button>
        )}
        {retryable && (
          <button type="button" className={secondaryButtonClass} onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

function ImportValidation({
  result,
  force,
  onReset,
}: {
  result: Draft;
  force: boolean;
  onReset: () => void;
}) {
  const save = useSaveRecipe();
  const navigate = useNavigate();
  const sourceUrl = result.draft.sourceUrl;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Vérifier l’import</h1>
        <button type="button" onClick={onReset} className="text-sm text-accent underline">
          Autre lien
        </button>
      </div>

      {result.warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {warning}
        </p>
      ))}

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 self-start text-sm text-zinc-500 underline dark:text-zinc-400"
        >
          Source : {new URL(sourceUrl).hostname} <ExternalLink size={14} aria-hidden />
        </a>
      )}

      <RecipeForm
        draft={result.draft}
        submitLabel="Enregistrer"
        onSubmit={async (input) => {
          const recipe = await save.mutateAsync({ ...input, force: force || undefined });
          navigate(`/recipes/${recipe.id}`, { replace: true });
        }}
      />
    </section>
  );
}
