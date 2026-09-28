import { Loader2 } from 'lucide-react';
import { errorMessage } from '../api/client';
import { secondaryButtonClass } from './ui';

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-zinc-400" role="status" aria-label="Chargement">
      <Loader2 className="animate-spin" size={28} />
    </div>
  );
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-zinc-600 dark:text-zinc-300">{errorMessage(error)}</p>
      <button type="button" className={secondaryButtonClass} onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}
