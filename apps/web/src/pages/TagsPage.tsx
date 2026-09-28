import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Tag, TagRef } from '@mes-recettes/shared';
import { ApiError, errorMessage } from '../api/client';
import { useCreateTag, useDeleteTag, useRenameTag, useTags } from '../api/tags';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadError, Loading } from '../components/QueryStatus';
import {
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

const recipesLabel = (count: number) => `${count} recette${count > 1 ? 's' : ''}`;

export function TagsPage() {
  const tags = useTags();
  const create = useCreateTag();
  const [name, setName] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(name, { onSuccess: () => setName('') });
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <BackLink to="/settings" />
        <h1 className="text-2xl font-semibold">Tags</h1>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nouveau tag"
          maxLength={40}
          className={inputClass}
          aria-label="Nouveau tag"
        />
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={!name.trim() || create.isPending}
        >
          <Plus size={18} aria-hidden /> Créer
        </button>
      </form>
      {create.isError && <p className="text-sm text-red-600">{errorMessage(create.error)}</p>}

      {tags.isPending && <Loading />}
      {tags.isError && <LoadError error={tags.error} onRetry={() => tags.refetch()} />}
      {tags.isSuccess && tags.data.length === 0 && (
        <p className="py-8 text-center text-zinc-500">
          Aucun tag. Ajoutez-en depuis une recette ou ci-dessus.
        </p>
      )}
      {tags.isSuccess && tags.data.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {tags.data.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [mergeTarget, setMergeTarget] = useState<TagRef | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function submit(event: FormEvent, merge = false) {
    event.preventDefault();
    rename.mutate(
      { id: tag.id, name, merge },
      {
        onSuccess: () => {
          setEditing(false);
          setMergeTarget(null);
        },
        onError: (err) => {
          // Nom déjà pris : on propose la fusion (spec F8).
          if (err instanceof ApiError && err.code === 'TAG_EXISTS') {
            setMergeTarget((err.details as { existing: TagRef }).existing);
          }
        },
      },
    );
  }

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={40}
            className={inputClass}
            aria-label={`Nouveau nom pour ${tag.name}`}
          />
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={rename.isPending}>
              Renommer
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setEditing(false)}
            >
              Annuler
            </button>
          </div>
        </form>
        <ConfirmDialog
          open={mergeTarget !== null}
          title="Fusionner les tags ?"
          message={`Le tag « ${mergeTarget?.name} » existe déjà. Ses recettes et celles de « ${tag.name} » seront regroupées sous « ${mergeTarget?.name} ».`}
          confirmLabel="Fusionner"
          pending={rename.isPending}
          onCancel={() => setMergeTarget(null)}
          onConfirm={() =>
            rename.mutate(
              { id: tag.id, name, merge: true },
              {
                onSuccess: () => {
                  setEditing(false);
                  setMergeTarget(null);
                },
              },
            )
          }
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-1">
      <Link to={`/recipes?tags=${tag.id}`} className="flex min-h-11 flex-1 items-center gap-2">
        <span className="font-medium">{tag.name}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {recipesLabel(tag.recipeCount)}
        </span>
      </Link>
      <button
        type="button"
        className={iconButtonClass}
        aria-label={`Renommer ${tag.name}`}
        onClick={() => {
          setName(tag.name);
          setEditing(true);
        }}
      >
        <Pencil size={18} />
      </button>
      <button
        type="button"
        className={iconButtonClass}
        aria-label={`Supprimer ${tag.name}`}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 size={18} />
      </button>
      <ConfirmDialog
        open={confirmDelete}
        title={`Supprimer « ${tag.name} » ?`}
        message={
          tag.recipeCount > 0
            ? `Le tag sera retiré de ${recipesLabel(tag.recipeCount)}. Les recettes ne sont pas supprimées.`
            : 'Ce tag n’est utilisé par aucune recette.'
        }
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(tag.id, { onSuccess: () => setConfirmDelete(false) })}
      />
    </li>
  );
}
