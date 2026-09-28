import { ChefHat, Clock, Star } from 'lucide-react';
import { Link } from 'react-router';
import type { RecipeCard as RecipeCardData } from '@mes-recettes/shared';
import { formatMinutes } from '../lib/format';

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/60"
    >
      <div className="relative aspect-[4/3] bg-zinc-200 dark:bg-zinc-800">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ChefHat className="absolute inset-0 m-auto text-zinc-400" size={40} aria-hidden />
        )}
        {recipe.isFavorite && (
          <Star
            className="absolute right-2 top-2 fill-amber-400 text-amber-400 drop-shadow"
            size={22}
            aria-label="Favori"
          />
        )}
        {recipe.status === 'to_try' && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-zinc-800">
            À tester
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h2 className="line-clamp-2 font-medium leading-snug">{recipe.title}</h2>
        {recipe.tags.length > 0 && (
          <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
            {recipe.tags
              .slice(0, 3)
              .map((tag) => tag.name)
              .join(' · ')}
          </p>
        )}
        {recipe.totalMinutes !== null && (
          <p className="mt-auto flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <Clock size={14} aria-hidden />
            {formatMinutes(recipe.totalMinutes)}
          </p>
        )}
      </div>
    </Link>
  );
}
