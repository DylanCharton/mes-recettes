import { useEffect, useRef } from 'react';
import { secondaryButtonClass } from './ui';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation dans un `<dialog>` natif (pas de `window.confirm`, bloquant et non stylable). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: Props) {
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
      onCancel={onCancel}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-2xl bg-white p-5 text-zinc-900 backdrop:bg-black/50 dark:bg-zinc-800 dark:text-zinc-100"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>
          Annuler
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 font-medium text-white disabled:opacity-50"
          onClick={onConfirm}
          disabled={pending}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
