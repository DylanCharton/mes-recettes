import type { AppType } from '@mes-recettes/api/app';
import type { ApiErrorBody, ErrorCode } from '@mes-recettes/shared';
import { hc } from 'hono/client';

export const api = hc<AppType>('/').api;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Renvoie le corps JSON d'une réponse réussie, ou lève une `ApiError` lisible. */
export async function unwrap<T>(res: {
  ok: boolean;
  status: number;
  json(): Promise<T>;
}): Promise<T> {
  if (res.ok) return res.status === 204 ? (undefined as T) : res.json();

  let body: ApiErrorBody | undefined;
  try {
    body = (await res.json()) as unknown as ApiErrorBody;
  } catch {
    // Réponse non JSON (proxy, serveur arrêté…).
  }
  throw new ApiError(
    res.status,
    body?.error.code ?? 'INTERNAL_ERROR',
    body?.error.message ?? `Erreur inattendue (${res.status})`,
    body?.error.details,
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Serveur injoignable, vérifiez la connexion';
  return error instanceof Error ? error.message : 'Erreur inattendue';
}
