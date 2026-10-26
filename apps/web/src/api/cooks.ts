import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CookEntry, CookList } from '@mes-recettes/shared';
import { api, unwrap } from './client';

const keys = { list: ['cooks'] as const };

export function useCooks() {
  return useQuery({
    queryKey: keys.list,
    queryFn: async (): Promise<CookList> => unwrap(await api.cooks.$get()),
  });
}

/** Rafraîchit la frise et le compteur de la fiche. */
function useInvalidateCooks() {
  const queryClient = useQueryClient();
  return (recipeId: number) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.list }),
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] }),
    ]);
}

export function useAddCook(recipeId: number) {
  const invalidate = useInvalidateCooks();
  return useMutation({
    mutationFn: async (cookedAt?: string): Promise<CookEntry> =>
      unwrap(
        await api.recipes[':id'].cooks.$post({
          param: { id: String(recipeId) },
          json: cookedAt ? { cookedAt } : {},
        }),
      ),
    onSuccess: () => invalidate(recipeId),
  });
}

export function useDeleteCook() {
  const invalidate = useInvalidateCooks();
  return useMutation({
    mutationFn: async (entry: CookEntry) =>
      unwrap(await api.cooks[':id'].$delete({ param: { id: String(entry.id) } })),
    onSuccess: (_, entry) => invalidate(entry.recipeId),
  });
}
