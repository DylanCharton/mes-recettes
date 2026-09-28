import type { ReactNode } from 'react';

type Props = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Suggestion non appliquée : bordure en pointillés. */
  suggested?: boolean;
  label?: string;
};

/** Bouton bascule arrondi (filtres rapides, saisons, tags suggérés). */
export function Chip({ active, onClick, children, suggested, label }: Props) {
  const style = active
    ? 'border-accent bg-accent text-white'
    : suggested
      ? 'border-dashed border-accent text-accent'
      : 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200';
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap ${style}`}
    >
      {children}
    </button>
  );
}
