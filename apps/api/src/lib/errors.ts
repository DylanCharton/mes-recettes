import type { ApiErrorBody, ErrorCode } from '@mes-recettes/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Erreur métier transformée en réponse JSON `{ error: { code, message, details } }`. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorBody(code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, ...(details !== undefined && { details }) } };
}

export const recipeNotFound = () => new AppError('NOT_FOUND', 404, 'Cette recette n’existe plus');
