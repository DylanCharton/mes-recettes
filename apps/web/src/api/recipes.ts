import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecipeDetail, RecipeInput, RecipeList, RecipePatch } from '@mes-recettes/shared';
import { filtersToParams, type Filters } from '../lib/filters';
import { api, unwrap } from './client';

const keys = {
  lists: ['recipes'] as const,
  list: (params: Record<string, string>) => ['recipes', params] as const,
  detail: (id: number) => ['recipe', id] as const,
};

export function useRecipes(filters: Filters) {
  const params = filtersToParams(filters);
  return useQuery({
    queryKey: keys.list(params),
    queryFn: async (): Promise<RecipeList> =>
      unwrap(await api.recipes.$get({ query: { ...params, limit: '200' } })),
    // Garde la liste affichée pendant la frappe : pas de clignotement.
    placeholderData: keepPreviousData,
  });
}

export function useRecipe(id: number) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async (): Promise<RecipeDetail> =>
      unwrap(await api.recipes[':id'].$get({ param: { id: String(id) } })),
  });
}

export function useSaveRecipe(id?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput): Promise<RecipeDetail> =>
      id === undefined
        ? unwrap(await api.recipes.$post({ json: input }))
        : unwrap(await api.recipes[':id'].$put({ param: { id: String(id) }, json: input })),
    onSuccess: (recipe) => {
      queryClient.setQueryData(keys.detail(recipe.id), recipe);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.lists }),
        queryClient.invalidateQueries({ queryKey: ['tags'] }),
      ]);
    },
  });
}

/** Favori, statut, notes, saisons : mise à jour optimiste de la fiche (retour visuel immédiat). */
export function usePatchRecipe(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: RecipePatch): Promise<RecipeDetail> =>
      unwrap(await api.recipes[':id'].$patch({ param: { id: String(id) }, json: patch })),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: keys.detail(id) });
      const previous = queryClient.getQueryData<RecipeDetail>(keys.detail(id));
      if (previous) {
        queryClient.setQueryData<RecipeDetail>(keys.detail(id), {
          ...previous,
          ...patch,
          notes: patch.notes === undefined ? previous.notes : patch.notes || null,
        });
      }
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(keys.detail(id), context.previous);
    },
    onSuccess: (recipe) => queryClient.setQueryData(keys.detail(id), recipe),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.lists }),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(await api.recipes[':id'].$delete({ param: { id: String(id) } })),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: keys.detail(id) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.lists }),
        queryClient.invalidateQueries({ queryKey: ['tags'] }),
      ]);
    },
  });
}

export function useIngredientSuggestions(query: string) {
  return useQuery({
    queryKey: ['ingredients', query],
    queryFn: async () => unwrap(await api.ingredients.$get({ query: { q: query } })),
    staleTime: 60_000,
  });
}

export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/images', { method: 'POST', body: form });
  return (await unwrap<{ imagePath: string }>(res)).imagePath;
}
