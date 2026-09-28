import { Plus, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { normalizeText, TAG_MAX_LENGTH } from '@mes-recettes/shared';
import { useTags } from '../api/tags';
import { inputClass } from './ui';

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags proposés par l'import : un tap les ajoute. */
  suggested?: string[];
};

const sameTag = (a: string, b: string) => normalizeText(a) === normalizeText(b);

/** Tags libres : puces supprimables, saisie avec autocomplétion native (datalist). */
export function TagInput({ value, onChange, suggested = [] }: Props) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const allTags = useTags().data ?? [];

  const add = (raw: string) => {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX_LENGTH);
    if (name && !value.some((tag) => sameTag(tag, name))) {
      // Réutilise l'orthographe d'un tag existant (« végétarien » plutôt que « vegetarien »).
      onChange([...value, allTags.find((tag) => sameTag(tag.name, name))?.name ?? name]);
    }
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const pendingSuggestions = suggested.filter((name) => !value.some((tag) => sameTag(tag, name)));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-accent/10 pl-3 text-sm text-accent">
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((t) => t !== tag))}
                  className="inline-flex size-9 items-center justify-center rounded-full"
                  aria-label={`Retirer le tag ${tag}`}
                >
                  <X size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {pendingSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Suggestions :</span>
          {pendingSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => add(name)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-accent px-3 text-accent"
            >
              <Plus size={14} aria-hidden /> {name}
            </button>
          ))}
        </div>
      )}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        list={listId}
        placeholder="Ajouter un tag…"
        enterKeyHint="done"
        maxLength={TAG_MAX_LENGTH}
        className={inputClass}
        aria-label="Ajouter un tag"
      />
      <datalist id={listId}>
        {allTags
          .filter((tag) => !value.some((t) => sameTag(t, tag.name)))
          .map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
      </datalist>
    </div>
  );
}
