import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppDeps } from '../app';
import { AppError, errorBody } from '../lib/errors';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageRoutes({ images }: AppDeps) {
  return new Hono().post(
    '/',
    bodyLimit({
      // Marge pour l'enveloppe multipart ; la taille du fichier est revérifiée ensuite.
      maxSize: MAX_IMAGE_BYTES + 64 * 1024,
      onError: (c) =>
        c.json(errorBody('PAYLOAD_TOO_LARGE', 'Image trop volumineuse (5 Mo max)'), 413),
    }),
    async (c) => {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!(file instanceof File)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Aucune image reçue');
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Image trop volumineuse (5 Mo max)');
      }

      const imagePath = await images.save(new Uint8Array(await file.arrayBuffer()));
      if (!imagePath) {
        throw new AppError(
          'UNSUPPORTED_MEDIA_TYPE',
          415,
          'Format non pris en charge (JPEG, PNG ou WebP)',
        );
      }
      return c.json({ imagePath }, 201);
    },
  );
}
