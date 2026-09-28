import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Restaure la position de défilement d'une page de liste au retour arrière (CA-F3).
 * `ready` : la liste est affichée, la page a donc sa hauteur finale.
 */
export function useScrollRestoration(ready: boolean) {
  const { key } = useLocation();
  const storageKey = `scroll:${key}`;
  const restored = useRef(false);

  useEffect(() => {
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(storageKey, String(window.scrollY));
        } catch {
          // Stockage indisponible : pas de restauration, sans conséquence.
        }
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    try {
      const y = Number(sessionStorage.getItem(storageKey));
      if (y > 0) window.scrollTo(0, y);
    } catch {
      // idem
    }
  }, [ready, storageKey]);
}
