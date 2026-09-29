import { useSyncExternalStore } from 'react';

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

// Chrome émet `beforeinstallprompt` très tôt, souvent avant l'ouverture des Réglages :
// on le capture dès le chargement du module (importé par main.tsx).
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferred = event as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

/** Fonction d'installation si le navigateur la propose, sinon `null` (déjà installée, iOS…). */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const event = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deferred,
  );
  if (!event) return null;
  return async () => {
    await event.prompt();
    deferred = null;
    notify();
  };
}
