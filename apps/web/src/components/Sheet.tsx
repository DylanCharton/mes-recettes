import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { iconButtonClass } from './ui';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode };

/** Feuille qui monte du bas de l'écran sur mobile (dialog natif, fermeture par Échap/retour). */
export function Sheet({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-lg rounded-t-2xl bg-white p-0 text-zinc-900 backdrop:bg-black/50 sm:mb-auto sm:rounded-2xl dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className={iconButtonClass} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </dialog>
  );
}
