import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tag, TagRef } from '@mes-recettes/shared';
import { api, unwrap } from './client';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => unwrap(await api.tags.$get()),
    staleTime: 60_000,
  });
}

/** Un changement de tag touche aussi les recettes (cartes, fiches) : on invalide tout. */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['tags', 'recipes', 'recipe'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useCreateTag() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (name: string): Promise<Tag> =>
      unwrap(await api.tags.$post({ json: { name } })),
    onSuccess: invalidate,
  });
}

export function useRenameTag() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { id: number; name: string; merge?: boolean }): Promise<TagRef> =>
      unwrap(
        await api.tags[':id'].$patch({
          param: { id: String(input.id) },
          json: { name: input.name, merge: input.merge },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteTag() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(await api.tags[':id'].$delete({ param: { id: String(id) } })),
    onSuccess: invalidate,
  });
}
