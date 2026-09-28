import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useRecipes } from '../api/recipes';
import { LoadError, Loading } from '../components/QueryStatus';
import { RecipeCard } from '../components/RecipeCard';
import { primaryButtonClass } from '../components/ui';

export function RecipesPage() {
  const recipes = useRecipes();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Recettes</h1>

      {recipes.isPending && <Loading />}
      {recipes.isError && <LoadError error={recipes.error} onRetry={() => recipes.refetch()} />}

      {recipes.isSuccess && recipes.data.items.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-zinc-600 dark:text-zinc-300">Aucune recette pour l’instant.</p>
          <Link to="/recipes/new" className={primaryButtonClass}>
            <Plus size={18} aria-hidden /> Ajouter une recette
          </Link>
        </div>
      )}

      {recipes.isSuccess && recipes.data.items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {recipes.data.items.map((recipe) => (
            <li key={recipe.id} className="flex">
              <RecipeCard recipe={recipe} />
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/recipes/new"
        aria-label="Nouvelle recette"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 inline-flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <Plus size={26} />
      </Link>
    </section>
  );
}
