import { useCallback, useState } from 'react';

type Checklist = { day: string; ingredients: number[]; steps: number[] };
type Kind = 'ingredients' | 'steps';

const today = () => new Date().toLocaleDateString('sv'); // AAAA-MM-JJ, heure locale
const storageKey = (recipeId: number) => `checklist:${recipeId}`;

function load(recipeId: number): Checklist {
  const empty = { day: today(), ingredients: [], steps: [] };
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey(recipeId)) ?? 'null',
    ) as Checklist | null;
    // Les coches valent pour la journée : le lendemain, on repart de zéro.
    return stored?.day === today() ? stored : empty;
  } catch {
    return empty;
  }
}

function save(recipeId: number, checklist: Checklist) {
  try {
    localStorage.setItem(storageKey(recipeId), JSON.stringify(checklist));
  } catch {
    // Stockage indisponible (navigation privée) : les coches restent en mémoire.
  }
}

/** Ingrédients et étapes cochés pendant la cuisine, propres à l'appareil (jamais en base). */
export function useLocalChecklist(recipeId: number) {
  const [checklist, setChecklist] = useState(() => load(recipeId));

  const update = useCallback(
    (next: Checklist) => {
      setChecklist(next);
      save(recipeId, next);
    },
    [recipeId],
  );

  const isChecked = (kind: Kind, id: number) => checklist[kind].includes(id);

  const toggle = (kind: Kind, id: number) =>
    update({
      ...checklist,
      [kind]: isChecked(kind, id)
        ? checklist[kind].filter((x) => x !== id)
        : [...checklist[kind], id],
    });

  const reset = () => update({ day: today(), ingredients: [], steps: [] });
  const hasChecks = checklist.ingredients.length + checklist.steps.length > 0;

  return { isChecked, toggle, reset, hasChecks };
}
