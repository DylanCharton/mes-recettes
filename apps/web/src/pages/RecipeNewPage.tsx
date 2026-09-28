import { useNavigate } from 'react-router';
import { useSaveRecipe } from '../api/recipes';
import { BackLink } from '../components/BackLink';
import { RecipeForm } from '../components/RecipeForm';

export function RecipeNewPage() {
  const save = useSaveRecipe();
  const navigate = useNavigate();

  return (
    <section>
      <BackLink to="/recipes" />
      <h1 className="mb-4 text-2xl font-semibold">Nouvelle recette</h1>
      <RecipeForm
        submitLabel="Enregistrer"
        onSubmit={async (input) => {
          const recipe = await save.mutateAsync(input);
          navigate(`/recipes/${recipe.id}`, { replace: true });
        }}
      />
    </section>
  );
}
