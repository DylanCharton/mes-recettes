import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { Db } from './db/client';
import type { AuthConfig } from './env';
import { AppError, errorBody } from './lib/errors';
import type { ImageStore } from './lib/imageStore';
import type { Logger } from './lib/logger';
import type { FetchFn } from './lib/safeFetch';
import { requireSession } from './lib/session';
import { createStaticHandler } from './lib/staticFiles';
import { authRoutes } from './routes/auth';
import { imageRoutes } from './routes/images';
import { importRoutes } from './routes/imports';
import { ingredientRoutes } from './routes/ingredients';
import { recipeRoutes } from './routes/recipes';
import { systemRoutes } from './routes/system';
import { tagRoutes } from './routes/tags';

/** Dépendances injectées : les tests fournissent une base en mémoire et un `fetch` simulé. */
export type AppDeps = {
  db: Db;
  logger: Logger;
  images: ImageStore;
  fetch: FetchFn;
  auth: AuthConfig;
  /** Origine publique attendue dans l'en-tête Origin (derrière Caddy) ; défaut : celle de la requête. */
  publicOrigin?: string;
  /** Front buildé à servir (production). */
  webDist?: string | null;
};

const PUBLIC_API_PATHS = ['/api/health', '/api/auth/me', '/api/auth/login', '/api/auth/logout'];
const JSON_BODY_LIMIT = 1024 * 1024;

export function createApp(deps: AppDeps) {
  const { logger, images, auth } = deps;
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

  // En-têtes de sécurité et CSP stricte (spec § 18.1). static.jow.fr : aperçu d'import et
  // image de repli uniquement.
  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://static.jow.fr'],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      referrerPolicy: 'same-origin',
      xFrameOptions: 'DENY',
    }),
  );

  // CSRF : les requêtes « formulaire » (multipart…) doivent venir de notre origine. Les requêtes
  // JSON cross-origin sont déjà bloquées par le navigateur (pré-vol refusé, pas de CORS).
  app.use('/api/*', csrf(deps.publicOrigin ? { origin: deps.publicOrigin } : undefined));

  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/images')) return next(); // limite propre (5 Mo)
    return bodyLimit({
      maxSize: JSON_BODY_LIMIT,
      onError: (ctx) => ctx.json(errorBody('PAYLOAD_TOO_LARGE', 'Requête trop volumineuse'), 413),
    })(c, next);
  });

  app.use('/api/*', requireSession(auth, PUBLIC_API_PATHS));
  app.use('/images/*', requireSession(auth, []));

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

  // Noms de fichiers uniques : cache « immuable », privé (images protégées par la session).
  app.get('/images/:file', async (c) => {
    const image = await images.read(c.req.param('file'));
    if (!image) return c.json(errorBody('NOT_FOUND', 'Image introuvable'), 404);
    return c.body(new Uint8Array(image.data), 200, {
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
  });

  const routes = app
    .route('/api', systemRoutes(deps))
    .route('/api/auth', authRoutes(deps))
    .route('/api/recipes', recipeRoutes(deps))
    .route('/api/images', imageRoutes(deps))
    .route('/api/imports', importRoutes(deps))
    .route('/api/tags', tagRoutes(deps))
    .route('/api/ingredients', ingredientRoutes(deps));

  // En production, le même processus sert le front (une seule origine, pas de CORS).
  if (deps.webDist) {
    const serveFront = createStaticHandler(deps.webDist);
    app.get('*', (c, next) =>
      c.req.path.startsWith('/api/') || c.req.path.startsWith('/images/') ? next() : serveFront(c),
    );
  }

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
