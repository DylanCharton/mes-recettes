import { Minus, Plus } from 'lucide-react';
import { MAX_TARGET_SERVINGS, MIN_TARGET_SERVINGS } from '@mes-recettes/shared';

type Props = { value: number; onChange: (value: number) => void };

export function ServingsStepper({ value, onChange }: Props) {
  const button =
    'inline-flex size-10 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 dark:border-zinc-700';
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Nombre de portions">
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={value <= MIN_TARGET_SERVINGS}
        aria-label="Une portion de moins"
      >
        <Minus size={18} />
      </button>
      <span className="min-w-16 text-center font-medium tabular-nums" aria-live="polite">
        {value} {value > 1 ? 'portions' : 'portion'}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_TARGET_SERVINGS}
        aria-label="Une portion de plus"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
