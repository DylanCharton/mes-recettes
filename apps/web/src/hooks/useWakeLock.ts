import { useEffect } from 'react';

export const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/**
 * Garde l'écran allumé tant que `active` est vrai (mode cuisine, spec § 20.4). Le navigateur
 * libère le verrou quand l'onglet passe en arrière-plan : on le reprend au retour.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !wakeLockSupported) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) void lock.release();
        else sentinel = lock;
      } catch {
        // Refusé (batterie faible, onglet masqué) : on réessaiera au prochain retour.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release();
    };
  }, [active]);
}
