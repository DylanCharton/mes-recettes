# Mes recettes — Plan d'implémentation

> Version 1.1 — 28/09/2026 — dérivé de [`specification.md`](./specification.md) (ajout des saisons, étape 3.5)

## Principes

- **Vertical** : chaque phase traverse DB → API → front et livre un produit utilisable.
- **Petites étapes** : chaque étape tient en une session de travail (≈ 1–3 h), se termine par un état vert (`pnpm lint && pnpm typecheck && pnpm test`) et peut faire l'objet d'un commit.
- **Tests là où ils paient** : parseurs, calculs, import, doublons, endpoints critiques (spec § 22). Pas de test sur l'UI triviale.
- **YAGNI** : on n'anticipe pas une phase dans la précédente. Une table ou une dépendance n'arrive qu'avec la fonctionnalité qui l'utilise.
- Chaque étape indique **Fait quand** : critère de sortie vérifiable.

Légende : 🧪 = étape qui ajoute des tests automatisés.

---

## Phase 0 — Socle technique

**Livrable** : `pnpm dev` lance l'API et le front ; la page d'accueil affiche « API OK » lue depuis `/api/health`.

| # | Étape | Fait quand |
|---|-------|------------|
| 0.1 | Initialiser Git dans `mes recettes/`, `.gitignore` (node_modules, dist, data, .env), `.editorconfig`, `README.md` minimal | `git status` propre après premier commit |
| 0.2 | Workspace pnpm : `package.json` racine, `pnpm-workspace.yaml`, `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), paquets vides `apps/api`, `apps/web`, `packages/shared` | `pnpm install` OK |
| 0.3 | ESLint (flat config + typescript-eslint) + Prettier + scripts racine `lint`, `format`, `typecheck` | `pnpm lint` et `pnpm typecheck` passent |
| 0.4 | Vitest configuré dans les 3 paquets, script racine `test` ; un test trivial dans `shared` 🧪 | `pnpm test` vert |
| 0.5 | API : Hono + `@hono/node-server`, `env.ts` (Zod : `PORT`, `DATA_DIR`, `LOG_LEVEL`, `NODE_ENV`), logger pino (+ pino-pretty en dev), middleware `requestId` + log par requête, gestionnaire d'erreurs `AppError` → JSON, `GET /api/health`, `tsx watch` 🧪 (health via `app.request()`) | `curl localhost:3000/api/health` → `{"status":"ok"}` |
| 0.6 | DB : Drizzle + better-sqlite3, `drizzle.config.ts`, `client.ts` (création de `DATA_DIR`, `PRAGMA foreign_keys=ON`, `journal_mode=WAL`), migrations appliquées au démarrage, table provisoire vide non requise — schéma réel en 1.1 | L'API démarre et crée `data/app.db` |
| 0.7 | Front : Vite + React + TS + Tailwind v4 + React Router + TanStack Query ; proxy `/api` et `/images` vers :3000 ; layout avec barre de navigation basse (entrées Recettes / Importer / Réglages, pages vides) ; page qui affiche le health | `pnpm dev` (les deux en parallèle) affiche « API OK » |
| 0.8 | Client API typé : export `AppType` depuis `apps/api/src/app.ts`, `hc<AppType>` dans `apps/web/src/api/client.ts` | Appel health typé sans `any` |

---

## Phase 1 — Recette manuelle de bout en bout

**Livrable** : je crée, liste, consulte, modifie et supprime des recettes saisies à la main, avec photo et recalcul des portions.

| # | Étape | Fait quand |
|---|-------|------------|
| 1.1 | Schéma Drizzle : `recipe`, `ingredient`, `recipe_ingredient`, `recipe_step` (spec § 12.1, sans tags ni courses) ; génération de la première migration SQL | Migration versionnée, appliquée au boot |
| 1.2 | `shared/ingredients` : `normalize` (texte sans accents, clé d'ingrédient avec pluriels), table des unités + alias, `parseIngredientLine` 🧪 (tableau § 16.3 + cas limites) | Tous les cas du tableau passent |
| 1.3 | `shared` : `scaleQuantity` + `formatQuantity` (fractions, arrondis g/ml, kg/l) 🧪 | Cas § 16.5 et CA-F4 passent |
| 1.4 | `shared/schemas` : `RecipeInput`, `RecipeDetail`, `RecipeCard`, schéma d'erreur (Zod) | Types exportés et utilisés par l'API |
| 1.5 | `recipeService.create/update/get/delete` + repository : transaction synchrone (recette + ingrédients + étapes), upsert d'ingrédient canonique, calcul `total_minutes` et `search_text`, règle « ligne inchangée = structure conservée » à l'update 🧪 (SQLite `:memory:`) | Tests de service verts |
| 1.6 | Routes `POST/GET/PUT/PATCH/DELETE /api/recipes[/:id]` + `GET /api/recipes` (sans filtres, tri récent) avec validation Zod 🧪 (intégration `app.request()`) | CRUD complet testé |
| 1.7 | Images : `POST /api/images` (multipart, 5 Mo, octets magiques, nom UUID) + service statique `/images/:file` (regex stricte, cache long, nosniff) ; suppression du fichier avec la recette 🧪 | Upload + affichage OK, fichier supprimé avec la recette |
| 1.8 | Front `RecipeForm` (création/modification) : titre, description, portions, temps, textarea ingrédients avec aperçu d'analyse (parseur partagé), textarea étapes, ustensiles, notes, photo avec redimensionnement navigateur (`resizeImage`) | Je crée une recette depuis le mobile |
| 1.9 | Front `/recipes` : grille de cartes (photo, titre, temps), bouton flottant « + » → `/recipes/new` ; états vide/chargement/erreur | Liste affichée, responsive 1→4 colonnes |
| 1.10 | Front `/recipes/:id` : fiche complète, `ServingsStepper` (recalcul affichage), ingrédients et étapes cochables (`useLocalChecklist`, stockage local par recette et par jour), menu ⋮ Modifier / Supprimer (confirmation) | CA-F4 (hors mode cuisine) et CA-F5/F6 validés à la main |

**Démo de fin de phase** : saisir 3 recettes de famille depuis le téléphone (réseau local, `vite --host`), les consulter en changeant les portions.

---

## Phase 2 — Import Jow

**Livrable** : je colle une URL Jow, je vérifie la recette pré-remplie, je l'enregistre ; photo stockée localement ; doublons détectés.

| # | Étape | Fait quand |
|---|-------|------------|
| 2.1 | Copier `docs/research/jow/*.html` vers `apps/api/test/fixtures/jow/` ; créer des fixtures dérivées : sans `__NEXT_DATA__`, sans JSON-LD ni NEXT_DATA (OpenGraph seul), NEXT_DATA corrompu | 5 fixtures présentes |
| 2.2 | `lib/safeFetch` : HTTPS, liste blanche d'hôtes passée en paramètre, port 443, redirections manuelles revalidées (max 3), timeout 10 s, lecture en flux avec plafond, contrôle du content-type, User-Agent explicite 🧪 (fetch simulé) | Tests SSRF de CA-F15 verts |
| 2.3 | `importers/html.ts` : extraction des blocs JSON-LD (tolérant : `@graph`, tableaux, bloc invalide ignoré), `__NEXT_DATA__`, OpenGraph, canonical ; `lib/text.ts` (HTML → texte brut) 🧪 | Extraction testée sur les fixtures |
| 2.4 | `importers/schemaOrg/mapper.ts` : `Recipe` → `RecipeDraft` (durées ISO, yield, instructions, images, nutrition « 8 g ») 🧪 | Brouillon JSON-LD correct pour les 2 fixtures |
| 2.5 | `importers/jow/` : `canHandle`, `identify` (externalId + URL canonique, sans réseau) 🧪 variantes d'URL et domaines piégés | CA-F1 (variantes) vert |
| 2.6 | `JowImporter.parse` : socle JSON-LD + enrichissement `__NEXT_DATA__` (schéma Zod permissif), conversion `quantityPerCover × coversCount`, table d'unités Jow, placard (`additionalConstituents`), facultatifs, ustensiles, nutrition, scores ; avertissements ; repli OpenGraph → `PARSE_FAILED` avec partiel 🧪 | CA-F1 (valeurs de la fixture curry + poulet rôti + dégradations) vert |
| 2.7 | Registre d'importeurs + `importService.preview` + `POST /api/imports/preview` (extraction d'URL depuis un texte, doublon avant fetch, rate limit 10/min & 2 simultanés) 🧪 | Preview testé avec `safeFetch` simulé |
| 2.8 | Enregistrement d'un brouillon : `POST /api/recipes` accepte les champs source, stocke `source_payload`, vérifie le doublon (409 sauf `force`), télécharge l'image (`imageService.downloadRemote`, repli si échec) 🧪 | CA-F12 et CA-F13 verts |
| 2.9 | Front `/import` : champ URL (`type="url"`), bouton **Coller**, lancement auto si `?url=…&auto=1`, écran de validation = `RecipeForm` pré-rempli + bandeau d'avertissements + écran « déjà existante » (Ouvrir / Importer quand même) + écran d'échec (Créer manuellement pré-rempli) | Parcours P2 complet à la main |
| 2.10 | Fiche : lien « Voir sur Jow », date d'import ; script `pnpm --filter api check:jow <url>` | Import de 5 vraies recettes Jow variées sans correction manuelle majeure |

**Démo de fin de phase** : importer 10 recettes Jow réelles, noter les écarts, transformer chaque écart en fixture + test.

---

## Phase 3 — Organisation et confort de cuisine

**Livrable** : je retrouve n'importe quelle recette en quelques secondes et je cuisine avec le téléphone.

| # | Étape | Fait quand |
|---|-------|------------|
| 3.1 | Migration : `tag`, `recipe_tag` ; `tagService` (normalisation, unicité, renommage, fusion, suppression) ; routes `/api/tags` 🧪 | CA-F8 (API) vert |
| 3.2 | Tags dans le formulaire (`TagInput` : chips + autocomplétion + création à la volée) et sur carte/fiche ; tags suggérés à l'import (cuisine, rapide, végétarien) non cochés par défaut 🧪 (`suggestTags`) | Tags posés depuis l'import et l'édition |
| 3.3 | Page `/tags` : liste avec compteurs, renommer (fusion confirmée), supprimer (confirmation avec compteur) ; tap → bibliothèque filtrée | CA-F8 (UI) validé |
| 3.4 | Statut et favori : PATCH rapide, étoile sur carte et fiche (mise à jour optimiste), sélecteur de statut dans le menu ⋮, pastille « à tester » | CA-F7 validé |
| 3.5 | Saisons : migration `recipe_season` ; `shared` : enum `Season`, libellés FR, `currentSeason(date)`, `suggestSeasons(keywords)` 🧪 ; `seasons` dans `RecipeInput`/`RecipeDetail`/PATCH (remplacement de l'ensemble, dans la même transaction que la recette) 🧪 ; `suggestedSeasons` dans le brouillon d'import (Jow `keywords`) 🧪 ; front : `SeasonPicker` (4 bascules + « Toute l'année ») dans le formulaire et l'écran de validation, affichage sur la fiche, édition rapide via le menu ⋮ | CA-F8b (saisie, affichage, suggestions) validé |
| 3.6 | `GET /api/recipes` : filtres `q` (search_text + tags), `tags` (ET), `favorite`, `status` (archivées exclues par défaut), `seasons` (OU, strict), `maxTime`, `source`, `ingredient`, tri, pagination ; échappement LIKE 🧪 | CA-F3 et CA-F8b (API) verts |
| 3.7 | `GET /api/ingredients?q=` (autocomplétion) | Suggestions affichées dans le filtre |
| 3.8 | Front bibliothèque : barre de recherche (debounce 200 ms), chips rapides (dont « De saison » calculée par `currentSeason`), `FilterSheet` (bottom sheet, section Saisons à sélection multiple), filtres synchronisés dans l'URL, restauration du défilement au retour | CA-F3 et CA-F8b (UI) validés sur S24 |
| 3.9 | Mode cuisine : `useWakeLock` (réacquisition sur `visibilitychange`), police agrandie, étape courante en évidence ; notes éditables en place sur la fiche | CA-F4 complet |

---

## Phase 4 — Mobile, authentification, mise en ligne → **MVP**

**Livrable** : l'app tourne sur le VPS en HTTPS ; depuis Jow sur le S24 Ultra : Partager → Mes recettes → Enregistrer.

> Arbitrage A2 tranché (28/09/2026) : scénario B, VPS + authentification, domaine `recettes.tojicode.fr`.

| # | Étape | Fait quand |
|---|-------|------------|
| 4.1 | Auth serveur : script `hash-password` (scrypt), variables `AUTH_PASSWORD_HASH`, `SESSION_SECRET`, `AUTH_DISABLED` (refus de démarrer en prod si rien n'est configuré), cookie signé, middleware de session sur `/api/*` et `/images/*`, rate limit login 🧪 | CA-F15 (auth) vert |
| 4.2 | Durcissement : `secureHeaders` + CSP (§ 18.1), middleware `csrf` (Origin), `bodyLimit` 1 Mo (5 Mo sur upload) 🧪 | Requête POST cross-origin refusée |
| 4.3 | Front : page `/login`, redirection sur 401 avec `?next=` (conserve l'URL d'import en cours), déconnexion dans `/settings` | Parcours « non connecté → partage → login → import » OK |
| 4.4 | PWA : `vite-plugin-pwa` (precache coque, `CacheFirst` images, `NetworkFirst` fiche recette), manifest complet, icônes (192, 512, maskable), invite de mise à jour discrète | Lighthouse « installable » vert |
| 4.5 | Share Target : `share_target` GET → route `/share` (URL depuis `url`, sinon `text`, sinon `title`) → `/import?url=…&auto=1` 🧪 (extraction) | Test d'extraction vert |
| 4.6 | Production : servir `apps/web/dist` depuis Hono (statique + fallback SPA, `index.html` sans cache), bundle API esbuild (`better-sqlite3` externe) | `pnpm build && pnpm start` sert tout sur :3000 |
| 4.7 | `Dockerfile` multi-étapes (node:22-slim, pnpm, volume `/data`, utilisateur non-root, `HEALTHCHECK` sur `/api/health`), `.dockerignore` | `docker run -v …:/data` fonctionne en local |
| 4.8 | Déploiement VPS : image transférée par SSH (`docker save`/`docker load`, sans registre — décision du 29/09/2026), service ajouté à la pile existante derrière Caddy (`recettes.tojicode.fr`), sauvegarde quotidienne de `data/` (cron), procédure dans le README | App accessible en HTTPS ✅ 29/09/2026 |
| 4.9 | **Recette sur le S24 Ultra** : installer la PWA depuis Chrome ; partager depuis l'app Jow et depuis jow.fr ; relever le contenu exact partagé (lien direct / texte / lien court) et ajuster l'extraction ou la liste blanche ; tester le mode avion sur une fiche déjà ouverte | CA-F11 validé — **MVP livré** |

---

## Phase 5 — Liste de courses et sauvegarde → **V1**

**Livrable** : j'ajoute des recettes à ma liste, je fais mes courses en cochant ; je peux exporter toute ma bibliothèque.

| # | Étape | Fait quand |
|---|-------|------------|
| 5.1 | `shared/shoppingList.ts` : `buildShoppingList` (mise à l'échelle, clés de fusion, groupes, placard, facultatifs, coches) 🧪 | CA-F9 (logique) vert |
| 5.2 | Migration : `shopping_list_recipe`, `shopping_list_item`, `shopping_list_check` ; `shoppingService` + routes § 14.6 🧪 | Endpoints testés |
| 5.3 | Front : bouton « + Courses » sur la fiche (choix des portions), sélection multiple dans la bibliothèque (appui long → mode sélection → « Ajouter aux courses ») | Ajout depuis les deux points d'entrée |
| 5.4 | Front `/shopping-list` : groupes par ingrédient, coche optimiste, articles libres, section placard repliée, recettes de la liste (modifier portions / retirer), « Retirer les cochés », « Vider » ; entrée « Courses » dans la barre basse ; cache `NetworkFirst` | CA-F9 validé en magasin 🙂 |
| 5.5 | `GET /api/export` (JSON complet) et `GET /api/backup` (copie SQLite à chaud) ; boutons dans `/settings` 🧪 (export) | CA-F14 validé |

---

## Phase 6 — Planning des repas → V1.5 (1/2)

| # | Étape | Fait quand |
|---|-------|------------|
| 6.1 | Migration `meal_plan_entry` ; service + routes § 14.7 (dont `to-shopping-list`) 🧪 | Endpoints testés |
| 6.2 | Front `/meal-plan` : vue semaine (lundi→dimanche, midi/soir), navigation semaines, ajout via recherche de recette + portions, note libre, suppression ; barre basse passe à 5 entrées (Plus = Tags + Réglages) | CA-F10 validé |
| 6.3 | « Ajouter la semaine aux courses » ; depuis la fiche : « Planifier » | Semaine → liste de courses en 1 tap |

## Phase 7 — Import élargi et petits plus → V1.5 (2/2)

| # | Étape | Fait quand |
|---|-------|------------|
| 7.1 | `safeFetch` mode « public » : résolution DNS + blocage des plages privées dans le `lookup` de l'agent HTTP (anti DNS-rebinding) 🧪 | Tests SSRF IP privées/IPv6/mappées verts |
| 7.2 | `GenericSchemaOrgImporter` (réutilise le mappeur) ; fixtures Marmiton, 750g, Cuisine AZ 🧪 | 3 sites importés sans code dédié (ou écarts documentés) |
| 7.3 | « Mettre à jour depuis la source » (ré-import conservant notes, tags, statut, favori) 🧪 | Recette rafraîchie sans perte des données personnelles |
| 7.4 | « Je l'ai cuisinée » (`last_cooked_at`, compteur, tri associé) ; bouton « Au hasard » | Disponibles dans la fiche / bibliothèque |
| 7.5 | Import depuis texte brut collé ; retéléchargement automatique des images en échec | — |

---

## Ordre de développement recommandé et jalons

```
Phase 0 ─► Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 4 ══► MVP (en production, utilisé au quotidien)
                                                  └─► Phase 5 ══► V1
                                                          └─► Phase 6 ─► Phase 7 ══► V1.5
```

- **Jalon MVP (fin phase 4)** : l'app remplace Jow comme bibliothèque. Utiliser 2–3 semaines avant d'attaquer la suite, en notant les frictions.
- **Jalon V1 (fin phase 5)** : courses + sauvegarde.
- Les phases 6 et 7 sont indépendantes : l'ordre peut être inversé selon l'usage réel (si j'importe beaucoup depuis d'autres sites, la phase 7 passe devant).

## Risques et parades

| Risque | Probabilité | Parade |
|--------|-------------|--------|
| Jow modifie la structure de `__NEXT_DATA__` | Moyenne | Repli JSON-LD automatique, avertissement, logs de stratégie, fixture + correctif ciblé |
| Jow bloque les requêtes serveur (anti-bot, 403) | Faible à moyenne | User-Agent explicite, 1 requête par import ; en dernier recours : bookmarklet/partage envoyant le HTML depuis le navigateur (à concevoir seulement si le cas survient) |
| Le partage depuis l'app Jow fournit un lien court non reconnu | Moyenne | Vérifié en 4.9 ; ajout du domaine de redirection en liste blanche |
| Compilation native `better-sqlite3` | Faible | Binaires précompilés Node 22 (Windows x64, Linux glibc) ; image Docker `node:22-slim` (glibc, pas Alpine) |
| Espace dans le nom du dossier « mes recettes » | Faible | Chemins toujours cités dans les scripts ; renommage possible sans impact sur le code |
| Dérive de périmètre | Moyenne | Toute nouvelle idée va dans V2 de la spec avant d'être codée |

## Définition de « terminé » (toutes étapes)

- `pnpm lint`, `pnpm typecheck`, `pnpm test` verts.
- Pas de `any` non justifié, pas de `console.log` (logger uniquement côté API).
- Messages d'erreur utilisateur en français, clairs et actionnables.
- Vérifié à la main sur mobile (Chrome Android ou émulation) pour toute étape UI.
- Spec mise à jour si une décision a changé.
