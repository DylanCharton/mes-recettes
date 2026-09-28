# Mes recettes

Bibliothèque de recettes personnelle : import depuis Jow, organisation, liste de courses.

- Cahier des charges : [`docs/specification.md`](docs/specification.md)
- Plan d'implémentation : [`docs/implementation-plan.md`](docs/implementation-plan.md)

## Prérequis

- Node.js ≥ 22.12
- pnpm 10 (`npm i -g pnpm`)

Aucune compilation native : `better-sqlite3` embarque ses binaires (Windows, Linux, macOS).

## Démarrage

```sh
pnpm install
cp .env.example .env
pnpm dev
```

- Front : <http://localhost:5173> (Vite, proxy `/api` et `/images` vers l'API)
- API : <http://localhost:3000/api/health>
- Données : `data/app.db` (SQLite) — dossier ignoré par Git

## Scripts

| Commande                                      | Rôle                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`                                    | API (tsx watch) + front (Vite) en parallèle                                |
| `pnpm test`                                   | Tests Vitest de tous les paquets                                           |
| `pnpm lint` / `pnpm typecheck`                | ESLint / TypeScript                                                        |
| `pnpm format`                                 | Prettier (hors `docs/`)                                                    |
| `pnpm --filter @mes-recettes/api db:generate` | Génère une migration SQL après modification de `apps/api/src/db/schema.ts` |

Les migrations (`apps/api/drizzle/`) sont appliquées automatiquement au démarrage de l'API.

## Structure

```
apps/api         API Hono + Drizzle/SQLite
apps/web         PWA React (Vite, Tailwind, TanStack Query)
packages/shared  Schémas Zod et logique partagée (parsing, portions, courses)
docs/            Spécification, plan, pages Jow archivées
```
