import { ChefHat, PartyPopper } from 'lucide-react';
import { Fragment, useLayoutEffect, useRef, type PointerEvent } from 'react';
import { Link } from 'react-router';
import type { CookEntry } from '@mes-recettes/shared';
import { useCooks } from '../api/cooks';
import { daysBetween, formatGap, startOfDay } from '../lib/format';

type Day = { date: Date; entries: CookEntry[] };

/** Recettes affichées côte à côte pour un même jour ; au-delà, « +n ». */
const MAX_PER_DAY = 3;

function groupByDay(entries: CookEntry[]): Day[] {
  const days: Day[] = [];
  for (const entry of entries) {
    const date = startOfDay(new Date(entry.cookedAt));
    const last = days.at(-1);
    if (last && last.date.getTime() === date.getTime()) last.entries.push(entry);
    else days.push({ date, entries: [entry] });
  }
  return days;
}

/** Espace entre deux jours : croît avec l'écart, mais en log pour qu'un an tienne à l'écran. */
const gapWidth = (days: number) => (days <= 1 ? 4 : Math.min(140, 4 + Math.log2(days) * 20));

const dayLabel = (date: Date, today: Date) => {
  const days = daysBetween(date, today);
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== today.getFullYear() && { year: '2-digit' }),
  });
};

/**
 * Frise des recettes cuisinées (« Je viens de la faire ! »), de la plus ancienne à aujourd'hui.
 * Défilement horizontal : au doigt nativement, à la souris par glisser.
 */
export function CookTimeline() {
  const cooks = useCooks();
  const items = cooks.data?.items;
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);

  // Ouverture sur les plus récentes, à droite.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [items?.length]);

  if (!items) return null;

  if (items.length === 0) {
    return (
      <section className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
        <PartyPopper size={28} className="shrink-0 text-accent" aria-hidden />
        <p className="text-zinc-600 dark:text-zinc-300">
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Votre frise</strong> se
          remplit à chaque « Je viens de la faire ! » en bas d’une recette.
        </p>
      </section>
    );
  }

  const today = startOfDay(new Date());
  const days = groupByDay(items);
  const lastDay = days.at(-1)!.date;
  const thisMonth = items.filter((entry) => {
    const date = new Date(entry.cookedAt);
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  }).length;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > 5) {
      state.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (state.moved) event.currentTarget.scrollLeft = state.scrollLeft - dx;
  };
  const endDrag = () => {
    // Le clic qui suit un glisser est annulé (onClickCapture) puis l'état est remis à zéro.
    setTimeout(() => (drag.current = null));
  };

  return (
    <section aria-labelledby="timeline-title" className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="timeline-title" className="font-semibold">
          Ma frise
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {items.length} plat{items.length > 1 ? 's' : ''}
          {thisMonth > 0 && ` · ${thisMonth} ce mois-ci`}
        </p>
      </div>

      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (drag.current?.moved) event.preventDefault();
        }}
        onDragStart={(event) => event.preventDefault()}
        className="-mx-4 cursor-grab overflow-x-auto px-4 pt-2 pb-1 select-none [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      >
        <ol className="relative flex w-max items-end" aria-label="Recettes cuisinées, par date">
          {/* Axe : centré sur les pastilles (libellé mt-1 + h-5, demi-pastille, demi-trait). */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-[calc(1.5rem+0.3125rem-1px)] h-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700"
          />
          {days.map((day, index) => {
            const previous = days[index - 1];
            const gap = previous ? daysBetween(previous.date, day.date) : 0;
            return (
              <Fragment key={day.date.getTime()}>
                {previous && <Gap days={gap} />}
                <DayColumn day={day} today={today} />
              </Fragment>
            );
          })}
          {daysBetween(lastDay, today) > 0 && (
            <>
              <Gap days={daysBetween(lastDay, today)} />
              <li className="flex w-20 shrink-0 flex-col items-center">
                <span
                  aria-hidden
                  className="relative z-[1] size-2.5 rounded-full border-2 border-accent bg-white dark:bg-zinc-900"
                />
                <span className="mt-1 h-5 text-xs font-medium text-accent">Aujourd’hui</span>
              </li>
            </>
          )}
        </ol>
      </div>
    </section>
  );
}

function Gap({ days }: { days: number }) {
  return (
    <li
      aria-hidden
      className="relative shrink-0 self-stretch"
      style={{ width: `${gapWidth(days)}px` }}
    >
      {days >= 7 && (
        <span className="absolute inset-x-0 bottom-0 h-5 text-center text-[0.65rem] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
          {formatGap(days)}
        </span>
      )}
    </li>
  );
}

function DayColumn({ day, today }: { day: Day; today: Date }) {
  const label = dayLabel(day.date, today);
  const longDate = day.date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hidden = day.entries.length - MAX_PER_DAY;
  const isToday = daysBetween(day.date, today) === 0;

  return (
    <li className="flex min-w-20 shrink-0 flex-col items-center">
      <ul className="mb-1.5 flex items-start">
        {day.entries.slice(-MAX_PER_DAY).map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/recipes/${entry.recipeId}`}
              draggable={false}
              aria-label={`${entry.title}, ${longDate}`}
              className="flex w-20 flex-col items-center gap-1 rounded-lg p-0.5 text-center"
            >
              {entry.imageUrl ? (
                <img
                  src={entry.imageUrl}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="size-12 rounded-full object-cover shadow ring-2 ring-white dark:ring-zinc-800"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-400 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-800">
                  <ChefHat size={22} aria-hidden />
                </span>
              )}
              <span className="line-clamp-2 text-[0.7rem] leading-tight text-zinc-700 dark:text-zinc-300">
                {entry.title}
              </span>
            </Link>
          </li>
        ))}
        {hidden > 0 && (
          <li className="self-center pr-1 text-xs text-zinc-500" aria-label={`et ${hidden} autres`}>
            +{hidden}
          </li>
        )}
      </ul>
      <span
        aria-hidden
        className={`relative z-[1] size-2.5 rounded-full ${isToday ? 'bg-accent' : 'bg-accent/70'}`}
      />
      <time
        dateTime={day.date.toISOString()}
        className={`mt-1 h-5 text-xs whitespace-nowrap ${isToday ? 'font-medium text-accent' : 'text-zinc-500 dark:text-zinc-400'}`}
      >
        {label}
      </time>
    </li>
  );
}
