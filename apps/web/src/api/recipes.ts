import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecipeDetail, RecipeInput, RecipeList } from '@mes-recettes/shared';
import { api, unwrap } from './client';

const keys = {
  list: ['recipes'] as const,
  detail: (id: number) => ['recipe', id] as const,
};

export function useRecipes() {
  return useQuery({
    queryKey: keys.list,
    queryFn: async (): Promise<RecipeList> => unwrap(await api.recipes.$get({ query: {} })),
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
      return queryClient.invalidateQueries({ queryKey: keys.list });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(await api.recipes[':id'].$delete({ param: { id: String(id) } })),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: keys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: keys.list });
    },
  });
}

export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/images', { method: 'POST', body: form });
  return (await unwrap<{ imagePath: string }>(res)).imagePath;
}
