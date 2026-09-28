import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import type { Db } from './db/client';
import { AppError, errorBody } from './lib/errors';
import type { ImageStore } from './lib/imageStore';
import type { Logger } from './lib/logger';
import type { FetchFn } from './lib/safeFetch';
import { imageRoutes } from './routes/images';
import { importRoutes } from './routes/imports';
import { ingredientRoutes } from './routes/ingredients';
import { recipeRoutes } from './routes/recipes';
import { systemRoutes } from './routes/system';
import { tagRoutes } from './routes/tags';

/** Dépendances injectées : les tests fournissent une base en mémoire et un `fetch` simulé. */
export type AppDeps = { db: Db; logger: Logger; images: ImageStore; fetch: FetchFn };

export function createApp(deps: AppDeps) {
  const { logger, images } = deps;
  const app = new Hono();

  app.use(requestId());

  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - start),
      },
      'request',
    );
  });

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(errorBody(err.code, err.message, err.details), err.status);
    }
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    logger.error({ err, requestId: c.get('requestId') }, 'unhandled error');
    return c.json(errorBody('INTERNAL_ERROR', 'Erreur inattendue'), 500);
  });

  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'Ressource introuvable'), 404));

  // Noms de fichiers uniques : cache navigateur « immuable » (spec § 14.4).
  app.get('/images/:file', async (c) => {
    const image = await images.read(c.req.param('file'));
    if (!image) return c.json(errorBody('NOT_FOUND', 'Image introuvable'), 404);
    return c.body(new Uint8Array(image.data), 200, {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  return app
    .route('/api', systemRoutes(deps))
    .route('/api/recipes', recipeRoutes(deps))
    .route('/api/images', imageRoutes(deps))
    .route('/api/imports', importRoutes(deps))
    .route('/api/tags', tagRoutes(deps))
    .route('/api/ingredients', ingredientRoutes(deps));
}

export type AppType = ReturnType<typeof createApp>;
