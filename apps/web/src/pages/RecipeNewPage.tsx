import { useLocation, useNavigate } from 'react-router';
import type { RecipeDraft } from '@mes-recettes/shared';
import { useSaveRecipe } from '../api/recipes';
import { BackLink } from '../components/BackLink';
import { RecipeForm } from '../components/RecipeForm';

type LocationState = { prefill?: { title: string; sourceUrl?: string } } | null;

export function RecipeNewPage() {
  const save = useSaveRecipe();
  const navigate = useNavigate();
  // Pré-remplissage après un import impossible (« Créer manuellement »).
  const prefill = (useLocation().state as LocationState)?.prefill;
  const draft: RecipeDraft | undefined = prefill && {
    title: prefill.title,
    servings: 2,
    sourceUrl: prefill.sourceUrl ?? null,
  };

  return (
    <section>
      <BackLink to="/recipes" />
      <h1 className="mb-4 text-2xl font-semibold">Nouvelle recette</h1>
      <RecipeForm
        draft={draft}
        submitLabel="Enregistrer"
        onSubmit={async (input) => {
          const recipe = await save.mutateAsync(input);
          navigate(`/recipes/${recipe.id}`, { replace: true });
        }}
      />
    </section>
  );
}
