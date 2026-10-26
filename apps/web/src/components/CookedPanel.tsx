import { CalendarDays, PartyPopper } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { CookEntry, RecipeDetail } from '@mes-recettes/shared';
import { errorMessage } from '../api/client';
import { useAddCook, useDeleteCook } from '../api/cooks';
import { usePatchRecipe } from '../api/recipes';
import { formatRelativeDay, ordinal } from '../lib/format';
import { Sheet } from './Sheet';
import { inputClass, primaryButtonClass } from './ui';

/** Date du jour au format d'un `<input type="date">` (heure locale). */
const todayInputValue = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * « Je viens de la faire ! » : alimente la frise de l'accueil. Après l'ajout, petite célébration
 * avec annulation possible (appui accidentel).
 */
export function CookedPanel({ recipe }: { recipe: RecipeDetail }) {
  const add = useAddCook(recipe.id);
  const remove = useDeleteCook();
  const patch = usePatchRecipe(recipe.id);
  /** Réalisation tout juste ajoutée et son rang (figé au clic, avant le rafraîchissement). */
  const [done, setDone] = useState<{ entry: CookEntry; rank: number } | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [date, setDate] = useState(todayInputValue);

  const record = (cookedAt?: string) => {
    const rank = recipe.cookCount + 1;
    add.mutate(cookedAt, {
      onSuccess: (entry) => {
        setDone({ entry, rank });
        setPickingDate(false);
      },
    });
  };

  if (done) {
    return (
      <section
        aria-live="polite"
        className="flex flex-col items-center gap-3 rounded-2xl bg-accent/10 p-5 text-center"
      >
        <span className="relative flex size-14 items-center justify-center rounded-full bg-accent text-white motion-safe:animate-cook-pop">
          <PartyPopper size={28} aria-hidden />
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="cook-burst absolute size-1.5 rounded-full bg-accent"
              style={{ '--angle': `${i * 45}deg` } as CSSProperties}
            />
          ))}
        </span>
        <div>
          <p className="text-lg font-semibold">Ajoutée à votre frise !</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {done.rank === 1
              ? 'Première fois : bravo.'
              : `C’est la ${ordinal(done.rank)} fois que vous la faites.`}
          </p>
        </div>

        {recipe.status === 'to_try' && (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white/70 px-4 py-3 text-sm dark:bg-zinc-900/50">
            <p>Vous l’adoptez ?</p>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={patch.isPending}
              onClick={() => patch.mutate({ status: 'validated' })}
            >
              La marquer « Validée »
            </button>
          </div>
        )}

        <div className="flex gap-4 text-sm">
          <Link to="/recipes" className="text-accent underline">
            Voir ma frise
          </Link>
          <button
            type="button"
            className="text-zinc-500 underline dark:text-zinc-400"
            disabled={remove.isPending}
            onClick={() => remove.mutate(done.entry, { onSuccess: () => setDone(null) })}
          >
            Annuler
          </button>
        </div>
        {remove.isError && <p className="text-sm text-red-600">{errorMessage(remove.error)}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/40 p-5 text-center">
      <p className="font-medium">
        {recipe.lastCookedAt
          ? `Déjà faite ${recipe.cookCount} fois, la dernière ${formatRelativeDay(recipe.lastCookedAt)}.`
          : 'C’est prêt ?'}
      </p>
      <button
        type="button"
        className={`${primaryButtonClass} px-6 text-lg`}
        disabled={add.isPending}
        onClick={() => record()}
      >
        <PartyPopper size={20} aria-hidden /> Je viens de la faire !
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 underline dark:text-zinc-400"
        onClick={() => {
          setDate(todayInputValue());
          setPickingDate(true);
        }}
      >
        <CalendarDays size={14} aria-hidden /> Je l’ai faite un autre jour
      </button>
      {add.isError && !pickingDate && (
        <p className="text-sm text-red-600">{errorMessage(add.error)}</p>
      )}

      <Sheet open={pickingDate} title="Quel jour ?" onClose={() => setPickingDate(false)}>
        <input
          type="date"
          value={date}
          max={todayInputValue()}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          aria-label="Date de réalisation"
        />
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!date || add.isPending}
          // Midi local : la date reste la même quel que soit le fuseau du serveur.
          onClick={() =>
            record(date === todayInputValue() ? undefined : new Date(`${date}T12:00`).toISOString())
          }
        >
          Ajouter à ma frise
        </button>
        {add.isError && <p className="text-sm text-red-600">{errorMessage(add.error)}</p>}
      </Sheet>
    </section>
  );
}
