import { useMutation } from '@tanstack/react-query';
import type { ImportPreviewRequest, ImportPreviewResponse } from '@mes-recettes/shared';
import { api, unwrap } from './client';

export function useImportPreview() {
  return useMutation({
    mutationFn: async (body: ImportPreviewRequest): Promise<ImportPreviewResponse> =>
      unwrap(await api.imports.preview.$post({ json: body })),
  });
}
