import { useNavigate, useParams } from 'react-router';
import { useRecipe, useSaveRecipe } from '../api/recipes';
import { BackLink } from '../components/BackLink';
import { LoadError, Loading } from '../components/QueryStatus';
import { RecipeForm } from '../components/RecipeForm';

export function RecipeEditPage() {
  const id = Number(useParams().id);
  const recipe = useRecipe(id);
  const save = useSaveRecipe(id);
  const navigate = useNavigate();

  return (
    <section>
      <BackLink to={`/recipes/${id}`} />
      <h1 className="mb-4 text-2xl font-semibold">Modifier la recette</h1>
      {recipe.isPending && <Loading />}
      {recipe.isError && <LoadError error={recipe.error} onRetry={() => recipe.refetch()} />}
      {recipe.isSuccess && (
        <RecipeForm
          recipe={recipe.data}
          submitLabel="Enregistrer les modifications"
          onSubmit={async (input) => {
            await save.mutateAsync(input);
            navigate(`/recipes/${id}`, { replace: true });
          }}
        />
      )}
    </section>
  );
}
