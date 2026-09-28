import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR';

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

export function errorBody(code: ErrorCode, message: string, details?: unknown) {
  return { error: { code, message, ...(details !== undefined && { details }) } };
}
