import type { AppType } from '@mes-recettes/api/app';
import { hc } from 'hono/client';

export const api = hc<AppType>('/').api;
