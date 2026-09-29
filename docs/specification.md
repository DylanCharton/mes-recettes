# Mes recettes — Cahier des charges fonctionnel et technique

> Version 1.1 — 28/09/2026 (ajout F8b « Saisons »)
> Statut : **validée** le 28/09/2026 — arbitrages tranchés au § 26.4
> Périmètre : application web personnelle de gestion de recettes, import Jow en priorité.

---

## Table des matières

1. [Vision du produit](#1-vision-du-produit)
2. [Objectifs](#2-objectifs)
3. [Hors périmètre](#3-hors-périmètre)
4. [Persona et usage principal](#4-persona-et-usage-principal)
5. [Parcours utilisateur](#5-parcours-utilisateur)
6. [Fonctionnalités](#6-fonctionnalités)
7. [MVP](#7-mvp)
8. [Fonctionnalités V1.5](#8-fonctionnalités-v15)
9. [Fonctionnalités V2](#9-fonctionnalités-v2)
10. [Architecture technique](#10-architecture-technique)
11. [Choix technologiques et justification](#11-choix-technologiques-et-justification)
12. [Modèle de données](#12-modèle-de-données)
13. [Diagramme textuel des relations](#13-diagramme-textuel-des-relations)
14. [Endpoints API](#14-endpoints-api)
15. [Fonctionnement détaillé de l'import Jow](#15-fonctionnement-détaillé-de-limport-jow)
16. [Stratégie de parsing](#16-stratégie-de-parsing)
17. [Gestion des erreurs](#17-gestion-des-erreurs)
18. [Sécurité](#18-sécurité)
19. [Stratégie images](#19-stratégie-images)
20. [Stratégie PWA / mobile](#20-stratégie-pwa--mobile)
21. [UX et navigation](#21-ux-et-navigation)
22. [Stratégie de tests](#22-stratégie-de-tests)
23. [Structure du repository](#23-structure-du-repository)
24. [Étapes de développement](#24-étapes-de-développement)
25. [Critères d'acceptation](#25-critères-dacceptation)
26. [Revue critique et arbitrages](#26-revue-critique-et-arbitrages)

---

## 1. Vision du produit

**Mes recettes** est ma bibliothèque de recettes personnelle, qui m'appartient.

Je découvre des recettes ailleurs (Jow d'abord, d'autres sites ensuite), je les enregistre **en deux gestes depuis mon téléphone**, et je les retrouve ensuite **sans dépendre de la source** : texte, quantités, étapes et photo sont copiés chez moi. Je les organise avec des tags, je les retrouve en quelques secondes, je les suis facilement en cuisinant et je génère ma liste de courses à partir de plusieurs recettes.

Principes directeurs :

- **Possession des données** : tout ce qui est importé est stocké localement (base SQLite + dossier d'images). Un dossier `data/` = toute ma bibliothèque.
- **Vitesse d'usage** : ouvrir, trouver, cuisiner. Peu de clics, pas d'animation décorative.
- **Mobile d'abord** : l'usage principal est un Galaxy S24 Ultra (Chrome Android).
- **Simplicité du code** : un seul serveur Node, une seule base, un seul front. Pas d'infrastructure à maintenir.
- **Résilience de l'import** : Jow peut changer son site ; l'import doit se dégrader proprement, jamais casser l'application.

## 2. Objectifs

| # | Objectif | Mesure concrète |
|---|----------|-----------------|
| O1 | Importer une recette Jow depuis le mobile avec un minimum d'étapes | Jow → Partager → Mes recettes → Enregistrer : **≤ 3 tapotements**, **< 5 s** hors réseau lent |
| O2 | Ne perdre aucune information à l'import | Texte original de chaque ingrédient toujours conservé ; payload source archivé |
| O3 | Retrouver une recette rapidement | Recherche texte + filtres en **< 300 ms** sur 1 000 recettes |
| O4 | Cuisiner confortablement avec le téléphone | Fiche lisible, portions ajustables, étapes cochables, écran maintenu allumé |
| O5 | Générer une liste de courses fusionnée | Ingrédients identiques et unités compatibles additionnés |
| O6 | Pérennité | Sauvegarde = copie du dossier `data/` ; export JSON complet disponible |
| O7 | Maintenabilité | Un développeur seul reprend le projet en < 1 h ; dépendances limitées et courantes |

## 3. Hors périmètre

Explicitement exclu (toutes versions sauf mention contraire) :

- Multi-utilisateur, partage social, comptes, rôles (V2 éventuelle, non conçue ici).
- Scraping en masse / synchronisation automatique du catalogue Jow. **Un import = une action volontaire sur une URL.**
- Utilisation de l'API privée de Jow (`/api/*`, interdite par leur `robots.txt` et non contractuelle).
- Moteur NLP de compréhension des ingrédients ; conversions d'unités avancées (g ↔ pièces, cuillère ↔ g).
- Calcul nutritionnel propre (on conserve seulement celui fourni par la source).
- Commande de courses en ligne, prix, drive.
- Mode hors-ligne complet avec édition et synchronisation.
- Application native (Android/iOS). La PWA suffit.
- Microservices, file de messages, Kubernetes, Redis, cache distribué.

## 4. Persona et usage principal

**Persona unique : moi.** Développeur, cuisine régulièrement, utilise Jow pour l'inspiration, veut sa propre bibliothèque.

Contextes d'usage :

| Contexte | Appareil | Fréquence | Besoin |
|----------|----------|-----------|--------|
| Découverte d'une recette sur Jow (app ou site) | Galaxy S24 Ultra | Plusieurs fois / semaine | Enregistrer en 2 gestes |
| Choix du repas / planification | Mobile ou PC | 1–2 fois / semaine | Rechercher, filtrer, planifier |
| Courses | Mobile, en magasin | 1 fois / semaine | Liste cochable, lisible à une main |
| Cuisine | Mobile posé sur le plan de travail | Quotidien | Gros texte, écran allumé, étapes cochables |
| Saisie d'une recette de famille | PC ou mobile | Occasionnel | Formulaire rapide (collage de texte) |

## 5. Parcours utilisateur

### P1 — Importer depuis Jow (parcours principal, mobile)

1. Dans l'app Jow ou dans Chrome sur jow.fr, j'ouvre une recette.
2. Je tape **Partager** → **Mes recettes** (PWA installée, cible de partage Android).
3. L'app s'ouvre sur `/import` avec l'URL pré-remplie et lance **automatiquement** l'analyse.
4. Un écran de validation affiche la recette pré-remplie : photo, titre, portions, temps, ingrédients, étapes, tags suggérés.
5. Je peux corriger / cocher des tags suggérés, puis je tape **Enregistrer**.
6. Je suis redirigé vers la fiche de la recette.

Variantes :

- **Recette déjà présente** (étape 3) : message « Cette recette existe déjà » + boutons **Ouvrir la recette** / **Importer quand même**.
- **Import partiel** : la recette est pré-remplie avec un bandeau d'avertissement (« ustensiles non récupérés », etc.).
- **Échec d'analyse** : message clair + bouton **Créer manuellement** (titre/photo pré-remplis si disponibles).
- **Non connecté** (scénario Internet) : passage par `/login`, puis retour automatique sur l'import en cours.

### P2 — Importer par copier-coller (fallback)

1. Je copie l'URL (depuis n'importe où).
2. J'ouvre l'app → onglet **Importer** → bouton **Coller** (ou saisie).
3. Suite identique à P1 à partir de l'étape 3.

### P3 — Retrouver et cuisiner une recette

1. Onglet **Recettes** → je tape « poulet » dans la recherche et j'active le filtre « ≤ 30 min ».
2. Je tape sur une carte → fiche recette.
3. J'ajuste les portions (2 → 4) : les quantités sont recalculées à l'affichage.
4. Je lance **Mode cuisine** : écran maintenu allumé, texte agrandi, je coche les ingrédients préparés et les étapes terminées.

### P4 — Liste de courses

1. Depuis une fiche (bouton **Ajouter aux courses**, avec nombre de portions) ou depuis la bibliothèque en sélection multiple.
2. Onglet **Courses** : liste fusionnée, groupée par ingrédient, section « À vérifier dans le placard » repliée.
3. En magasin, je coche les articles. **Retirer les cochés** / **Vider la liste** en fin de courses.

### P5 — Saisie manuelle

1. **Recettes** → bouton **+** → **Nouvelle recette**.
2. Je remplis le titre, colle les ingrédients (un par ligne) et les étapes (une par ligne), ajoute une photo depuis la galerie/appareil photo.
3. Aperçu immédiat de l'analyse des ingrédients (quantité / unité / ingrédient) sous la zone de texte.
4. **Enregistrer**.

### P6 — Planifier la semaine (V1.5)

1. Onglet **Planning** : vue semaine, 7 jours × midi / soir.
2. Tap sur une case vide → recherche de recette → choix des portions.
3. **Ajouter la semaine aux courses** alimente la liste de courses.

## 6. Fonctionnalités

Légende des versions : **MVP** (utilisable au quotidien), **V1** (MVP + courses, premier jalon « complet »), **V1.5**, **V2**.

### F1 — Import de recette depuis une URL Jow — MVP

- Coller / partager une URL Jow ; formats acceptés :
  `https://jow.fr/fr/recipes/<slug>-<id>`, `https://jow.fr/recipes/<slug>-<id>`, `https://jow.fr/en/recipes/…`, suffixe `/print`, paramètres de requête et ancres ignorés, `www.` toléré, `http://` réécrit en `https://`.
- Extraction du texte partagé : si le partage fournit un texte du type « Découvre cette recette … https://jow.fr/… », la première URL est extraite.
- Vérification de doublon **avant** tout appel réseau (l'identifiant Jow est dans l'URL).
- Analyse → brouillon (non enregistré) → écran de validation → enregistrement.
- Données extraites : titre, description, image, portions, temps de préparation / cuisson / total, difficulté, ingrédients (quantité, unité, nom, texte original, optionnel, « à avoir chez soi »), étapes, ustensiles, nutrition par portion, Nutri-Score, Green-Score, cuisine, URL canonique, identifiant Jow, date d'import. Voir § 15.

### F2 — Architecture d'importeurs extensible — MVP (interface) / V1.5+ (autres sources)

- Interface `RecipeImporter` commune ; registre d'importeurs interrogés dans l'ordre.
- MVP : `JowImporter` (utilise en interne le mappeur schema.org).
- V1.5 : `GenericSchemaOrgImporter` (n'importe quelle URL publique contenant un `Recipe` schema.org).
- V2 : importeurs dédiés Marmiton, 750g, Cuisine AZ uniquement si le générique ne suffit pas.
- La saisie manuelle n'est pas un importeur : c'est le formulaire de création (F6), qui partage le même format de brouillon.

### F3 — Bibliothèque — MVP

- Grille de cartes (1 colonne sur mobile étroit, 2 sur mobile large, 3–4 sur desktop) : photo, titre, temps total, 3 premiers tags, icône favori, pastille de statut si « à tester ».
- Recherche texte insensible à la casse et aux accents sur titre, ingrédients et tags.
- Filtres : tags (ET logique), favoris, statut, saisons (OU logique, voir F8b), temps total maximal (15 / 30 / 45 / 60 min), source, ingrédient présent.
- Tri : plus récentes (défaut), titre A→Z, temps total croissant, dernière modification.
- Filtres rapides en « chips » horizontales sous la barre de recherche : ★ Favoris, De saison, ≤ 30 min, À tester, + tags les plus utilisés.
- Filtres avancés dans une feuille (bottom sheet).
- État des filtres reflété dans l'URL (`/recipes?q=poulet&maxTime=30`) : partageable, bouton retour cohérent.
- Archivées masquées par défaut (visibles via le filtre statut).

### F4 — Fiche recette — MVP

- Affichage : image, titre, source (lien externe), portions, temps (prép. / cuisson / total), difficulté, tags, saisons, ingrédients, ustensiles, étapes, notes personnelles, nutrition, Nutri-Score / Green-Score.
- Sélecteur de portions (− / +) avec recalcul **à l'affichage uniquement** ; les quantités stockées ne changent jamais.
- Ingrédients « à avoir chez soi » affichés dans un sous-bloc distinct ; optionnels marqués « facultatif ».
- Ingrédients et étapes cochables (état local à l'appareil, réinitialisable).
- **Mode cuisine** : Wake Lock (écran maintenu allumé), police agrandie, étape courante mise en avant.
- Actions : favori (1 tap), changer le statut, modifier, supprimer (confirmation), ajouter aux courses.
- Notes personnelles modifiables directement depuis la fiche (sans passer par le formulaire complet).

### F5 — Modification d'une recette — MVP

- Même formulaire que la création et que l'écran de validation d'import.
- Les ingrédients sont édités comme du texte (une ligne = un ingrédient). Une ligne **inchangée** conserve ses données structurées d'origine (utile pour les données Jow, plus précises que le re-parsing) ; une ligne modifiée ou nouvelle est ré-analysée.
- Les étapes sont éditées une par ligne (réordonnables en déplaçant les lignes).
- Remplacement ou suppression de la photo.

### F6 — Création manuelle — MVP

- Champs : titre (obligatoire), description, portions (défaut 2), temps prép. / cuisson / total, ingrédients (textarea), étapes (textarea), photo (upload, redimensionnée côté navigateur), tags, saisons, notes, ustensiles (liste libre séparée par des virgules).
- Aperçu de l'analyse ingrédient par ingrédient.
- `source = manual`, pas d'URL source.

### F7 — Statut et favori — MVP

- **Statut** (exclusif) : `à tester` (défaut à l'import), `validée`, `archivée`.
- **Favori** : booléen indépendant du statut (une recette validée peut être favorite ou non).
- Justification et point « à refaire » : voir § 12.3 et § 26.

### F8 — Tags — MVP

- Tags libres, créés à la volée depuis le formulaire (autocomplétion) ou depuis la page `/tags`.
- Page `/tags` : liste avec nombre de recettes, renommage, suppression (confirmation indiquant le nombre de recettes concernées), fusion implicite (renommer un tag vers un nom existant fusionne les deux, après confirmation).
- Unicité insensible à la casse et aux accents (« Végétarien » = « vegetarien »).
- Tap sur un tag (fiche ou page tags) → bibliothèque filtrée.
- **Tags suggérés à l'import** (non cochés par défaut) : cuisine (« Indienne » → `indien`), `rapide` si temps total ≤ 30 min, `végétarien` / `vegan` si la source l'indique. Les mots-clés SEO de Jow (« enfant, viandard, saignant… ») **ne sont pas** transformés en tags (bruit).
- Pas de concept « catégorie » séparé : une catégorie est un tag (voir § 26).

### F8b — Saisons — MVP

- Chaque recette peut être associée à **0, 1 ou plusieurs saisons** parmi une liste fermée : `printemps`, `été`, `automne`, `hiver` (codes `spring`, `summer`, `autumn`, `winter`).
- Sélection dans le formulaire (création, modification, écran de validation d'import) par 4 boutons bascule (icônes fleur / soleil / feuille / flocon + libellé), avec un raccourci **Toute l'année** qui coche les 4.
- Sémantique :
  - **aucune saison cochée** = « non renseignée » (valeur par défaut, y compris à l'import) ;
  - **les 4 cochées** = « toute l'année » (affiché ainsi sur la fiche).
- Affichage sur la fiche, à côté des tags (« 🍂 Automne · ❄️ Hiver » ou « Toute l'année ») ; pas sur les cartes (lisibilité), sauf la pastille « de saison » si le filtre correspondant est actif.
- Modification rapide depuis la fiche (menu ⋮ → Saisons), sans passer par le formulaire complet.
- **Filtres** :
  - filtre « Saisons » dans la feuille de filtres : sélection multiple, logique **OU** (« été ou printemps ») — contrairement aux tags (ET), car une recette ne peut pas être « à la fois » de deux saisons au sens du filtre ;
  - chip rapide **De saison** = saison courante, calculée côté client selon les saisons météorologiques (mars–mai printemps, juin–août été, septembre–novembre automne, décembre–février hiver) ;
  - filtre strict : une recette sans saison renseignée n'apparaît pas dans un filtre de saison ; une recette « toute l'année » apparaît dans tous ;
  - combinable avec tous les autres filtres (ET entre familles de filtres).
- **Suggestions à l'import** (non cochées par défaut, comme les tags) : déduites des mots-clés de la source (`printemps`/`spring`, `été`/`ete`/`summer`, `automne`/`automn`/`autumn`, `hiver`/`winter`). Constat Jow : il n'existe pas de saisonnalité au niveau de la recette (seulement une `seasonality` par ingrédient et par zone, incomplète) ; en revanche les mots-clés contiennent parfois la saison (le poulet rôti au potimarron porte « automne », « hiver »).
- Pourquoi pas de simples tags « été » / « hiver » : liste fermée (pas de variantes « Été » / « estival »), sélection multiple guidée, logique de filtre OU spécifique et filtre « de saison » calculé automatiquement. Les tags ne doivent donc pas servir aux saisons.

### F9 — Liste de courses — V1

- Ajout d'une recette avec un nombre de portions (défaut : portions de la recette).
- Sélection multiple depuis la bibliothèque → **Ajouter aux courses**.
- Liste **calculée** à partir des recettes ajoutées + articles manuels :
  - fusion si même ingrédient canonique **et** même unité normalisée ;
  - sinon lignes séparées, affichées côte à côte sous le même ingrédient ;
  - ingrédients sans ingrédient canonique identifié : ligne brute non fusionnée ;
  - ingrédients « à avoir chez soi » dans une section repliée « À vérifier dans le placard ».
- Articles cochables ; ajout d'articles libres (« papier cuisson ») ; retrait d'une recette de la liste (recalcul automatique) ; **Retirer les cochés** ; **Vider la liste**.
- Une seule liste courante (pas d'historique en V1).

### F10 — Planning des repas — V1.5

- Vue semaine (lundi → dimanche), navigation semaine précédente / suivante, 2 créneaux : midi, soir.
- Une case = 0..n entrées ; une entrée = recette + portions, **ou** note libre (« restes », « resto »).
- Déplacer une entrée = la supprimer et la recréer (pas de glisser-déposer en V1.5).
- **Ajouter la semaine aux courses**.

### F11 — Import depuis le mobile (PWA + Share Target) — MVP

- PWA installable, cible de partage Android ; voir § 20.
- Fallbacks : bouton **Coller**, URL `…/import?url=…`, favori navigateur.

### F12 — Déduplication — MVP

- Clé : `(source, external_id)` ; à défaut, URL canonique.
- Vérifiée avant l'analyse (économie d'un appel réseau) et de nouveau à l'enregistrement.
- **Importer quand même** crée une seconde recette indépendante (utile pour une variante).
- V1.5 : **Mettre à jour depuis la source** (ré-import qui remplace les données source en conservant notes, tags, statut, favori).

### F13 — Images locales — MVP

- Téléchargement et stockage local de l'image à l'enregistrement ; voir § 19.

### F14 — Sauvegarde / export — V1

- Export JSON complet (recettes avec saisons, ingrédients, tags, planning, courses) depuis `/settings`.
- Téléchargement d'une copie cohérente de la base SQLite (sauvegarde à chaud).
- Documentation : sauvegarde = copie de `data/` (base + images).

### F15 — Authentification simple — MVP si exposition Internet

- Un seul mot de passe, session par cookie ; voir § 18.2.

## 7. MVP

Le MVP est ce qui me permet d'**arrêter d'utiliser Jow comme bibliothèque** dès sa mise en service.

| Inclus dans le MVP | Fonctionnalité |
|--------------------|----------------|
| ✅ | F1 Import Jow (JSON-LD + état Next.js, doublons, écran de validation) |
| ✅ | F2 Interface d'importeurs (Jow seul implémenté) |
| ✅ | F3 Bibliothèque : recherche, filtres (tags, favoris, statut, temps, ingrédient, source), tri |
| ✅ | F4 Fiche recette : portions recalculées, étapes/ingrédients cochables, mode cuisine, notes |
| ✅ | F5 Modification, F6 Création manuelle |
| ✅ | F7 Statut + favori, F8 Tags (CRUD + suggestions à l'import), F8b Saisons (sélection multiple + filtres + « De saison ») |
| ✅ | F11 PWA installable + Share Target + fallbacks |
| ✅ | F12 Déduplication, F13 Images locales |
| ✅ | F15 Auth simple (si déploiement Internet — recommandé, voir § 18) |
| ✅ | Déploiement : Dockerfile unique |

**V1 = MVP + F9 (liste de courses) + F14 (export/sauvegarde).**

## 8. Fonctionnalités V1.5

- F10 Planning des repas (vue semaine) + « Ajouter la semaine aux courses ».
- `GenericSchemaOrgImporter` : import de toute URL publique contenant un `Recipe` schema.org (couvre probablement Marmiton, 750g, Cuisine AZ sans code dédié), avec protection SSRF complète (§ 18.3).
- Ré-import « Mettre à jour depuis la source ».
- Bouton « Je l'ai cuisinée » → `last_cooked_at` + compteur ; tri « pas cuisinée depuis longtemps ».
- Bouton « Au hasard » dans la bibliothèque (respecte les filtres actifs).
- Import depuis le texte brut collé (sans URL) : un bloc texte → brouillon via le parseur de lignes.
- Tentative automatique de re-téléchargement des images en échec.

## 9. Fonctionnalités V2

- Importeurs dédiés (Marmiton, 750g, Cuisine AZ) **seulement** pour les sites où le générique échoue.
- Page d'administration des ingrédients : renommage, **fusion** d'ingrédients canoniques (« Carotte » / « Carottes râpées »), rayon de magasin.
- Tri de la liste de courses par rayon.
- Conversions d'unités simples (càs ↔ ml pour les liquides) dans la fusion de courses.
- Recherche plein texte FTS5 si les performances LIKE deviennent insuffisantes (> 5 000 recettes).
- Consultation hors-ligne étendue (toutes les recettes, pas seulement les récentes).
- Sections d'ingrédients (« Pour la sauce »), sous-recettes.
- Migration PostgreSQL si besoin réel (multi-utilisateur, hébergement managé).
- Tests end-to-end (Playwright) sur les parcours P1 et P3.

## 10. Architecture technique

### 10.1 Vue d'ensemble

```
┌──────────────────────── Navigateur (Chrome Android / desktop) ───────────────────────┐
│  PWA React (Vite)                                                                    │
│  - React Router, TanStack Query, Tailwind                                            │
│  - Service worker (vite-plugin-pwa) : coque applicative + cache images/recettes lues │
│  - manifest.webmanifest : share_target → /share                                      │
└───────────────────────────────┬──────────────────────────────────────────────────────┘
                                │ HTTPS (même origine : /api/*, /images/*, /*)
┌───────────────────────────────▼──────────────────────────────────────────────────────┐
│  Serveur Node unique (Hono)                                                          │
│  ├─ /api/*     routes REST (validation Zod)                                          │
│  ├─ /images/*  fichiers images locaux (cache long)                                   │
│  └─ /*         fichiers statiques du front buildé + fallback SPA                     │
│                                                                                      │
│  Couches : routes → services → repositories (Drizzle)                                │
│            importers/ (JowImporter, schemaOrgMapper, safeFetch)                      │
└───────────────┬───────────────────────────────────┬──────────────────────────────────┘
                │                                   │ fetch sortant (liste blanche, timeout, taille max)
        ┌───────▼────────┐                  ┌───────▼────────┐
        │ data/app.db    │                  │ jow.fr         │
        │ (SQLite)       │                  │ static.jow.fr  │
        │ data/images/   │                  └────────────────┘
        └────────────────┘
```

- **Un seul processus** en production : l'API sert aussi le front buildé → une seule origine, pas de CORS, un seul conteneur.
- En développement : Vite (port 5173) avec proxy `/api` et `/images` vers l'API (port 3000). Pas de Docker nécessaire.

### 10.2 Couches backend

| Couche | Rôle | Règle |
|--------|------|-------|
| `routes/` | HTTP : validation Zod des entrées, codes de statut, mapping d'erreurs | Aucune logique métier, aucun accès DB direct |
| `services/` | Logique métier : création/màj de recette, déduplication, courses | Pur TypeScript, testable sans HTTP |
| `db/` | Schéma Drizzle, client, migrations, requêtes | Seul endroit qui connaît SQLite |
| `importers/` | Récupération et extraction d'une recette distante → `RecipeDraft` | Ne touche jamais la base |
| `lib/` | safeFetch, logger, rate limit, erreurs, stockage images | Utilitaires sans état métier |

### 10.3 Code partagé (`packages/shared`)

Uniquement ce qui sert **aux deux côtés** :

- schémas Zod des DTO (`RecipeDraft`, `RecipeInput`, `RecipeDetail`, `RecipeCard`, filtres, courses…) et types inférés ;
- parseur de ligne d'ingrédient (utilisé par l'import côté serveur **et** par l'aperçu du formulaire côté client) ;
- normalisation de texte (minuscules, sans accents) et table des unités ;
- enum des saisons, libellés FR et `currentSeason(date)` (chip « De saison ») ;
- calcul des portions (affichage côté client) et formatage des quantités (fractions) ;
- construction de la liste de courses (fonction pure, appelée par le serveur, testée isolément).

## 11. Choix technologiques et justification

| Sujet | Choix | Pourquoi | Alternatives écartées |
|-------|-------|----------|-----------------------|
| Langage | TypeScript strict partout | Types partagés front/back, refactoring sûr | — |
| Runtime | Node.js 22 LTS (ou 24 LTS) | Déjà installé (22.14), `fetch` natif | Bun/Deno : moins courants, pas de gain décisif |
| Gestion de paquets | **pnpm workspaces** (sans Turborepo) | Déjà installé ; 3 paquets suffisent, pas besoin d'orchestrateur | npm workspaces (ok aussi), Turborepo/Nx (inutiles à cette échelle) |
| Front | **React 19 + Vite** | Stack déjà maîtrisée (Budgetator, gestion-clients) ; écosystème TanStack Query / react-hook-form ; `vite-plugin-pwa` mature | Vue 3 : excellent aussi, mais aucun gain qui justifie de changer d'habitudes |
| Routage front | React Router (mode déclaratif) | Simple, connu | TanStack Router : plus typé mais plus de concepts |
| Données front | TanStack Query | Cache, invalidation, états de chargement sans code maison | Redux/Zustand : inutiles (état serveur uniquement) |
| Formulaires | État React simple + validation Zod côté serveur (erreurs par champ renvoyées au formulaire) | Le seul formulaire riche (recette) n’a qu’une dizaine de champs, dont deux zones de texte : une bibliothèque de formulaires n’apporterait rien | react-hook-form : à reconsidérer si les formulaires se multiplient |
| Style | Tailwind CSS v4 + composants maison (≈ 10) | Rapide, sobre, pas de bibliothèque UI à suivre ; icônes `lucide-react` | shadcn/ui : pertinent mais surdimensionné pour ~10 composants |
| Backend | **Hono** (+ `@hono/node-server`) | Très léger, standards Web (Request/Response), middlewares intégrés utiles ici (cookies signés, CSRF par Origin, en-têtes de sécurité, limite de taille de corps, fichiers statiques), `@hono/zod-validator`, tests via `app.request()` sans serveur, client typé `hc<AppType>` sans génération de code | Fastify : solide mais plus de plugins à assembler ; Express : vieillissant, typage faible ; NestJS : surdimensionné pour ce projet |
| Base | **SQLite** via `better-sqlite3` | Fichier unique, zéro administration, très rapide, sauvegarde triviale ; binaires précompilés Windows/Linux | libSQL (ok, mais moins éprouvé) ; `node:sqlite` (encore expérimental) |
| ORM | **Drizzle ORM** + drizzle-kit | Léger, proche du SQL, typage fort, migrations SQL versionnées et lisibles, pas de moteur binaire ; `drizzle-zod` possible | Prisma : plus lourd (génération client, moteur), abstraction plus épaisse ; bascule PG un peu plus simple, mais ce gain ne compense pas |
| Validation | Zod | Standard de fait, partagé front/back, validation des env vars | Valibot : plus léger mais moins connu |
| Parsing HTML | `node-html-parser` | Rapide, sans dépendance, suffisant pour lire `<script>` et `<meta>` | cheerio (plus lourd), jsdom (beaucoup trop lourd) |
| Logs | `pino` (+ `pino-pretty` en dev) | JSON structuré, rapide, standard | Console maison : possible mais réinventer les niveaux |
| Tests | Vitest | Même outil front/back, rapide, compatible Vite | Jest : configuration TS plus lourde |
| Lint / format | ESLint (flat config, typescript-eslint) + Prettier | Standard | Biome : bon candidat, mais ESLint est déjà connu |
| Build API prod | esbuild (bundle unique `dist/server.js`, `better-sqlite3` en externe) | Embarque `packages/shared` sans étape de build séparée | tsc multi-projets : plus de configuration |
| Déploiement | Dockerfile multi-étapes unique | Colle à l'infra VPS existante (Caddy « edge » + Docker) | Docker Compose obligatoire : non (§ 11.2) |

### 11.1 Portabilité vers PostgreSQL

La migration doit rester « un après-midi de travail », pas une réécriture. Règles :

- Toutes les requêtes passent par Drizzle et sont regroupées dans `services/`. Elles sont **synchrones** (`.get()`, `.all()`, `.run()`), comme le pilote better-sqlite3 et ses transactions ; un portage PG les passera en `async`/`await`, changement mécanique et localisé dans `services/`.
- Dates stockées en texte ISO 8601 UTC (`2026-09-27T10:00:00.000Z`) et dates de planning en `YYYY-MM-DD` : portable et lisible.
- Aucune fonctionnalité spécifique SQLite dans le métier (pas de FTS5, pas de JSON1 dans les requêtes). Les colonnes JSON sont lues/écrites comme du texte sérialisé par le code.
- Identifiants entiers auto-incrémentés (équivalent `serial`/`identity` en PG).
- Portage = réécrire `schema.ts` avec `pg-core` (mécanique), régénérer les migrations, script d'export/import des données (l'export JSON F14 sert de base).
- **Point d'attention** : avec `better-sqlite3`, les transactions Drizzle sont **synchrones** (callback non `async`). Les écritures multi-tables (recette + ingrédients + étapes + tags) sont donc regroupées dans quelques fonctions de repository clairement identifiées, à adapter lors d'un portage.

### 11.2 Docker : utile ou pas ?

- **Développement** : non. `pnpm install && pnpm dev` suffit. SQLite = un fichier.
- **Production** : un `Dockerfile` (Node 22 slim, multi-étapes) produit une image autonome ; les données vivent dans un volume monté sur `/data`. C'est cohérent avec le VPS existant (pile Caddy « edge »). L'image est transférée par SSH sans registre (décision du 29/09/2026) ; ghcr.io pourra être branché avec une CI.
- **Docker Compose** : pas de fichier dans le dépôt en V1. Le service s'ajoute en quelques lignes à la pile existante du VPS (documenté dans le README au moment du déploiement).

## 12. Modèle de données

Conventions : tables au singulier en `snake_case`, clés primaires `id INTEGER` auto-incrémentées, dates en texte ISO UTC, booléens en `INTEGER 0/1` (mode booléen Drizzle), suppression en cascade des enfants d'une recette.

### 12.1 Tables

#### `recipe`

| Colonne | Type | Contraintes / remarques |
|---------|------|-------------------------|
| `id` | integer | PK |
| `title` | text | not null, ≤ 200 car. |
| `description` | text | null, texte brut (HTML retiré) |
| `servings` | integer | not null, défaut 2, 1–100 — **portions de référence des quantités stockées** |
| `servings_label` | text | null, ex. « poulets rôtis » (libellé source, informatif) |
| `prep_minutes` | integer | null |
| `cook_minutes` | integer | null |
| `total_minutes` | integer | null ; si absent à l'enregistrement et prép./cuisson connus → somme |
| `difficulty` | integer | null, 1 = facile, 2 = moyen, 3 = difficile |
| `status` | text | not null, `to_try` \| `validated` \| `archived`, défaut `to_try` |
| `is_favorite` | boolean | not null, défaut false |
| `notes` | text | null, notes personnelles (texte brut, retours à la ligne conservés) |
| `tools` | text (JSON) | null, `string[]` des ustensiles |
| `nutrition` | text (JSON) | null, `{ kcal?, fat?, carbs?, protein?, fiber?, sugar?, salt? }` **par portion** |
| `nutri_score` | text | null, `A`…`E` |
| `green_score` | text | null, `A+`, `A`…`F` |
| `cuisine` | text | null, ex. « Indienne » |
| `image_path` | text | null, nom de fichier local dans `data/images/` |
| `image_source_url` | text | null, URL d'origine de l'image (retéléchargement possible) |
| `source` | text | not null, `manual` \| `jow` \| `schema_org` (extensible) |
| `source_url` | text | null, URL **canonique** |
| `external_id` | text | null, identifiant chez la source (Jow : `89y06dxjhfua0twu16x5`) |
| `source_payload` | text (JSON) | null, données brutes extraites (objet recette Jow / JSON-LD), pour ré-analyse future sans refetch |
| `search_text` | text | not null, `normalize(title + ingrédients)`, maintenu par le service |
| `imported_at` | text | null, date de l'import |
| `created_at` | text | not null |
| `updated_at` | text | not null |

Index : `(source, external_id)` (non unique, voir § 12.3), `source_url`, `status`, `is_favorite`, `total_minutes`, `created_at`.

#### `ingredient` (ingrédient canonique)

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `name` | text | not null, nom d'affichage (« Poulet (escalope) », « Carotte ») |
| `normalized_name` | text | not null, **unique**, clé de rapprochement (§ 16.4) |
| `created_at` | text | not null |

#### `recipe_ingredient`

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `recipe_id` | integer | FK → recipe, cascade |
| `ingredient_id` | integer | FK → ingredient, **null** si non identifiable |
| `position` | integer | not null, ordre d'affichage |
| `quantity` | real | null (« sel, poivre ») — quantité pour `recipe.servings` portions |
| `unit` | text | null ; code canonique (`g`, `ml`, `piece`, `tbsp`, `tsp`, `pinch`, `bunch`, `clove`, `slice`, `can`, `pack`, `sprig`, `leaf`…) ou libellé brut en minuscules si inconnu |
| `name` | text | **not null**, nom tel qu'écrit dans la ligne (« carottes ») : sert à l'affichage recalculé des portions |
| `original_text` | text | **not null**, texte d'origine — jamais perdu |
| `is_optional` | boolean | not null, défaut false |
| `is_pantry` | boolean | not null, défaut false — « à avoir chez soi » |

Index : `recipe_id`, `ingredient_id`.

#### `recipe_step`

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `recipe_id` | integer | FK → recipe, cascade |
| `position` | integer | not null |
| `text` | text | not null, ≤ 2 000 car. |

#### `tag`

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `name` | text | not null, nom d'affichage (« Végétarien ») |
| `normalized_name` | text | not null, **unique** (« vegetarien ») |
| `created_at` | text | not null |

#### `recipe_tag`

| Colonne | Type | Remarques |
|---------|------|-----------|
| `recipe_id` | integer | FK → recipe, cascade |
| `tag_id` | integer | FK → tag, cascade |
| | | PK composite `(recipe_id, tag_id)` |

#### `recipe_season`

| Colonne | Type | Remarques |
|---------|------|-----------|
| `recipe_id` | integer | FK → recipe, cascade |
| `season` | text | not null, `spring` \| `summer` \| `autumn` \| `winter` (contrainte `CHECK` + enum Zod partagé) |
| | | PK composite `(recipe_id, season)` |

Index : `season`. Aucune ligne = saison non renseignée ; 4 lignes = toute l'année.

#### `shopping_list_recipe` — V1

Recettes ajoutées à la liste de courses courante.

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `recipe_id` | integer | FK → recipe, cascade |
| `servings` | integer | not null |
| `created_at` | text | not null |

Une même recette peut apparaître deux fois (ex. deux repas de la semaine) : ses quantités s'additionnent.

#### `shopping_list_item` — V1

Articles ajoutés manuellement.

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `label` | text | not null, ≤ 200 car. |
| `checked` | boolean | not null, défaut false |
| `created_at` | text | not null |

#### `shopping_list_check` — V1

État coché des lignes **calculées**.

| Colonne | Type | Remarques |
|---------|------|-----------|
| `item_key` | text | PK, ex. `i:42\|g` (ingrédient 42 en grammes) ou `t:huile d olive` (ligne brute normalisée) |
| `checked_at` | text | not null |

Une ligne cochée = une ligne présente dans cette table. « Vider la liste » supprime le contenu des trois tables.

#### `meal_plan_entry` — V1.5

| Colonne | Type | Remarques |
|---------|------|-----------|
| `id` | integer | PK |
| `date` | text | not null, `YYYY-MM-DD` |
| `slot` | text | not null, `lunch` \| `dinner` |
| `recipe_id` | integer | FK → recipe, **set null** à la suppression de la recette ; null si note libre |
| `servings` | integer | null (défaut : portions de la recette) |
| `note` | text | null, ex. « restes » |
| `created_at` | text | not null |

Index : `date`. Contrainte applicative : `recipe_id` ou `note` renseigné.

### 12.2 Pourquoi pas de tables `MealPlan` et `ShoppingList` ?

- **`MealPlan`** : une semaine n'est qu'une plage de dates. Une table parente n'apporterait qu'un identifiant sans information. Les entrées datées suffisent.
- **`ShoppingList`** : une seule liste courante en V1. Si plusieurs listes deviennent utiles (V2), on ajoute `shopping_list` et une colonne `list_id` (migration triviale).
- **Liste calculée plutôt que matérialisée** : stocker « quelles recettes, combien de portions » et calculer la fusion à la lecture permet de **retirer une recette** proprement (impossible de « défusionner » une liste matérialisée), garde les quantités à jour si une recette est corrigée, et concentre la logique dans une seule fonction pure testable (`buildShoppingList`). Le coût de calcul est négligeable (quelques dizaines de lignes).

### 12.3 Choix de modélisation discutés

**Statut vs favori.** La liste initiale (« à tester, validée, favorite, à refaire, archivée ») mélange deux axes : le *cycle de vie* (jamais testée → adoptée → abandonnée) et la *préférence* (j'adore). Une recette peut être validée **et** favorite ; si « favorite » était un statut, il faudrait choisir. D'où :

- `status` ∈ { `to_try` (à tester), `validated` (validée), `archived` (archivée) } ;
- `is_favorite` booléen indépendant.

« **À refaire** » est ambigu : « envie de la refaire bientôt » (→ favori, ou planning V1.5) ou « à retravailler » (→ note + tag `à retravailler`). Il n'est donc pas un statut en V1 ; arbitrage demandé au § 26.

**Catégories.** Pas de table dédiée : « plat », « dessert », « asiatique » sont des tags. Un deuxième système de classement doublerait l'UI et les filtres pour un gain nul en usage personnel.

**Saisons : table de liaison plutôt que colonne.** Trois options ont été comparées : un masque de bits (`seasons INTEGER`, compact mais illisible en base et en SQL), une colonne JSON (filtrage non portable) et une table `recipe_season` avec un enum fermé. La table est retenue : lisible, filtrage simple et portable (`EXISTS … WHERE season IN (…)`), identique en SQLite et en PostgreSQL, et cohérente avec `recipe_tag`. Contrairement aux tags, il n'y a pas de table `season` : la liste est fixe et vit dans le code (enum Zod partagé), ce qui évite toute gestion (création/renommage) inutile.

**Ustensiles et nutrition en JSON.** Jamais filtrés ni joints : une table n'apporterait rien. Nutri-Score et Green-Score, potentiellement filtrables, sont des colonnes simples.

**Doublons : index non unique.** L'unicité `(source, external_id)` est vérifiée par le service, pas par la base, pour permettre **« Importer quand même »** (variante volontaire). L'usage étant mono-utilisateur, le risque de course est nul.

**`source_payload`.** Conserver les données extraites (≈ 20–60 Ko par recette Jow, sans les recettes similaires) permet de ré-analyser plus tard avec un parseur amélioré, même si Jow retire la page. C'est l'application directe de « ne perdre aucune information ».

**Quantités stockées pour `servings` portions.** Jow fournit des quantités *par portion* (`quantityPerCover`) : elles sont multipliées par `coversCount` à l'import afin que les données stockées correspondent à ce qui est affiché dans la source. Le recalcul d'affichage est `quantity × portions_cibles / servings`.

**Unités normalisées à l'enregistrement.** Masses en `g` (kg, mg convertis), volumes en `ml` (l, cl, dl convertis). Ainsi, « 0,5 kg » et « 300 g » fusionnent sans table de conversion au moment de la liste de courses. Le formatage d'affichage repasse en `kg`/`l` au-delà de 1 000.

## 13. Diagramme textuel des relations

```
                       ┌──────────────┐
                       │     tag      │
                       └──────┬───────┘
                              │ 1
                              │
                              │ n
┌───────────────┐ 1     n ┌───┴──────────┐
│    recipe     ├─────────┤  recipe_tag  │
│               │         └──────────────┘
│               │ 1  0..4 ┌───────────────┐
│               ├─────────┤ recipe_season │   (enum fermé : spring/summer/autumn/winter)
│               │         └───────────────┘
│               │ 1     n ┌──────────────┐
│               ├─────────┤ recipe_step  │
│               │         └──────────────┘
│               │ 1     n ┌───────────────────┐ n     0..1 ┌──────────────┐
│               ├─────────┤ recipe_ingredient ├────────────┤  ingredient  │
│               │         └───────────────────┘            └──────────────┘
│               │ 1     n ┌──────────────────────┐
│               ├─────────┤ shopping_list_recipe │   (V1)
│               │         └──────────────────────┘
│               │ 0..1  n ┌──────────────────────┐
│               ├─────────┤   meal_plan_entry    │   (V1.5, recipe_id nullable)
└───────────────┘         └──────────────────────┘

Tables indépendantes (V1) :
  shopping_list_item   (articles manuels)
  shopping_list_check  (état coché des lignes calculées, clé = ingrédient|unité)
```

Cardinalités :

- `recipe` 1 — n `recipe_step`, `recipe_ingredient`, `recipe_tag` (suppression en cascade).
- `recipe_ingredient` n — 0..1 `ingredient` (ligne non identifiée possible, texte original toujours présent).
- `recipe` n — n `tag` via `recipe_tag`.
- `recipe` 1 — 0..4 `recipe_season` (cascade ; valeurs issues d'un enum fermé, pas de table de référence).
- `recipe` 1 — n `shopping_list_recipe` (cascade : supprimer une recette la retire des courses).
- `recipe` 0..1 — n `meal_plan_entry` (`set null` : l'entrée devient orpheline et s'affiche « recette supprimée »).

## 14. Endpoints API

Conventions :

- Préfixe `/api`, JSON en entrée/sortie, `camelCase` dans les DTO.
- Validation Zod de tous les paramètres, corps et requêtes → `400 VALIDATION_ERROR` avec détail par champ.
- Format d'erreur unique : `{ "error": { "code": "DUPLICATE_RECIPE", "message": "Cette recette existe déjà", "details": { … } } }`.
- Toutes les routes (sauf `/api/health` et `/api/auth/login`) exigent une session si l'authentification est active.

### 14.1 Authentification

| Méthode | Route | Description | Réponses |
|---------|-------|-------------|----------|
| POST | `/api/auth/login` | `{ password }` → pose le cookie de session | 204, 401 `INVALID_CREDENTIALS`, 429 |
| POST | `/api/auth/logout` | Supprime le cookie | 204 |
| GET | `/api/auth/me` | `{ authenticated: true, authEnabled: boolean }` | 200, 401 |

### 14.2 Recettes

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/recipes` | Liste de cartes filtrée. Requête : `q`, `tags` (ids séparés par virgule, ET), `favorite=1`, `status` (`to_try`,`validated`,`archived`, multiple), `seasons` (`spring`,`summer`,`autumn`,`winter`, multiple, **OU**), `maxTime` (minutes), `source`, `ingredient` (texte), `sort` (`recent` \| `title` \| `time` \| `updated`), `limit` (défaut 60, max 200), `offset`. Réponse : `{ items: RecipeCard[], total }` |
| GET | `/api/recipes/:id` | `RecipeDetail` complet (ingrédients, étapes, tags, nutrition…) |
| POST | `/api/recipes` | Crée depuis un `RecipeInput` (formulaire manuel **ou** brouillon d'import validé). Si le corps contient `source`/`externalId` d'une recette existante et pas `force: true` → `409 DUPLICATE_RECIPE` avec `{ existingId }`. Télécharge l'image si `imageSourceUrl` fourni. → `201 RecipeDetail` |
| PUT | `/api/recipes/:id` | Remplace les champs éditables (y compris lignes d'ingrédients, étapes, tags). Les lignes d'ingrédients dont le texte est identique à une ligne existante conservent leur structure. → `200 RecipeDetail` |
| PATCH | `/api/recipes/:id` | Mise à jour partielle rapide : `status`, `isFavorite`, `notes`, `seasons` (remplace l'ensemble) → `200` |
| DELETE | `/api/recipes/:id` | Supprime la recette et son image locale → `204` |

`RecipeInput` (extrait) :

```ts
{
  title: string;                // 1..200
  description?: string | null;
  servings: number;             // 1..100
  servingsLabel?: string | null;
  prepMinutes?: number | null; cookMinutes?: number | null; totalMinutes?: number | null;
  difficulty?: 1 | 2 | 3 | null;
  ingredients: Array<{          // max 100
    text: string;               // texte original, obligatoire
    // champs structurés facultatifs, fournis par un importeur :
    name?: string; quantity?: number | null; unit?: string | null;
    isOptional?: boolean; isPantry?: boolean;
  }>;
  steps: string[];              // max 60
  tools?: string[];
  tags?: string[];              // noms ; un tag inconnu est créé (unicité insensible casse/accents)
  seasons?: Array<'spring' | 'summer' | 'autumn' | 'winter'>;  // sans doublon, [] = non renseignée
  notes?: string | null;
  status?: 'to_try' | 'validated' | 'archived'; isFavorite?: boolean;
  nutrition?: Nutrition | null; nutriScore?: string | null; greenScore?: string | null; cuisine?: string | null;
  imagePath?: string | null;        // image déjà uploadée
  imageSourceUrl?: string | null;   // image distante à télécharger (import)
  source?: 'manual' | 'jow' | 'schema_org';
  sourceUrl?: string | null; externalId?: string | null; sourcePayload?: unknown;
  force?: boolean;                  // « Importer quand même »
}
```

Règle : si une ligne d'ingrédient arrive **sans** champs structurés, le serveur applique le parseur (§ 16.3). Les champs structurés fournis par un importeur de confiance sont revalidés mais pas ré-analysés.

### 14.3 Import

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/imports/preview` | `{ url }` (ou `{ text }` contenant une URL). Normalise, choisit l'importeur, vérifie les doublons, récupère et analyse. **N'enregistre rien.** |

Réponses :

- `200 { status: "ok", draft: RecipeDraft, provider: "jow", strategies: ["json_ld", "next_data"], warnings: string[], suggestions: { tags, seasons } }`
- `200 { status: "duplicate", existing: { id, title, imageUrl } , canonicalUrl }` — l'analyse n'est pas faite ; le client peut rappeler avec `{ url, force: true }`.
- `422 UNSUPPORTED_URL` (domaine non pris en charge), `422 PARSE_FAILED` (avec `details.partial` : titre/image OpenGraph si trouvés), `502 SOURCE_UNREACHABLE`, `504 SOURCE_TIMEOUT`, `429 RATE_LIMITED`.

`RecipeDraft` = `RecipeInput` pré-rempli (sans tags, notes, statut, favori ni saisons). Les propositions sont renvoyées à côté du brouillon : `suggestions: { tags: string[]; seasons: Season[] }`, affichées non cochées.

### 14.4 Images

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/images` | Upload multipart (`file`), ≤ 5 Mo, JPEG/PNG/WebP (vérification des octets magiques) → `201 { imagePath }` |
| GET | `/images/:file` | Fichier statique, `Cache-Control: public, max-age=31536000, immutable` (noms de fichiers uniques) |

### 14.5 Tags et ingrédients

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/tags` | `[{ id, name, recipeCount }]`, tri par nom |
| POST | `/api/tags` | `{ name }` → 201 ; 409 `TAG_EXISTS` si le nom normalisé existe |
| PATCH | `/api/tags/:id` | `{ name, merge?: boolean }` ; si le nom existe déjà : 409 `TAG_EXISTS` sauf `merge: true` (réaffecte les recettes puis supprime l'ancien) |
| DELETE | `/api/tags/:id` | Supprime le tag et ses associations → 204 |
| GET | `/api/ingredients?q=` | Autocomplétion du filtre « ingrédient » : `[{ id, name, recipeCount }]`, max 20 |

### 14.6 Liste de courses — V1

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/shopping-list` | Liste calculée : `{ recipes: [{ id, recipeId, title, servings }], groups: [{ ingredientName, lines: [{ key, quantity, unit, label, checked, isOptional, fromRecipes }] }], pantry: [...], manualItems: [...] }` |
| POST | `/api/shopping-list/recipes` | `{ recipeId, servings? }` ou `{ recipeIds: number[] }` (sélection multiple) → 201 |
| PATCH | `/api/shopping-list/recipes/:id` | `{ servings }` |
| DELETE | `/api/shopping-list/recipes/:id` | Retire une recette de la liste |
| POST | `/api/shopping-list/items` | `{ label }` → article manuel |
| PATCH | `/api/shopping-list/items/:id` | `{ label?, checked? }` |
| DELETE | `/api/shopping-list/items/:id` | — |
| PUT | `/api/shopping-list/checks/:key` | Coche une ligne calculée (clé encodée URL) |
| DELETE | `/api/shopping-list/checks/:key` | Décoche |
| POST | `/api/shopping-list/clear-checked` | Retire les articles manuels cochés et les recettes dont toutes les lignes sont cochées ; purge les coches |
| DELETE | `/api/shopping-list` | Vide tout |

### 14.7 Planning — V1.5

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/meal-plan?from=YYYY-MM-DD&to=YYYY-MM-DD` | Entrées de la période (max 31 jours) avec titre/image des recettes |
| POST | `/api/meal-plan` | `{ date, slot, recipeId?, servings?, note? }` |
| PATCH | `/api/meal-plan/:id` | Champs partiels |
| DELETE | `/api/meal-plan/:id` | — |
| POST | `/api/meal-plan/to-shopping-list` | `{ from, to }` → ajoute chaque entrée-recette à la liste de courses |

### 14.8 Divers

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | `{ status: "ok", version }` (sans authentification) |
| GET | `/api/export` | V1 — JSON complet (téléchargement `mes-recettes-YYYY-MM-DD.json`) |
| GET | `/api/backup` | V1 — copie cohérente de la base SQLite (`better-sqlite3` `backup()`) |

## 15. Fonctionnement détaillé de l'import Jow

### 15.1 Constats (analyse de pages réelles du 27/09/2026)

Pages analysées : `poulet-au-curry-89y06dxjhfua0twu16x5` (1 portion) et `poulet-roti-au-miel-et-aux-epices-8uzk9vraelo3jgw70jpx` (4 portions). Copies archivées dans `docs/research/jow/` : elles deviendront les premières fixtures de test.

| Source dans la page | Présente | Contenu utile | Stabilité estimée |
|---------------------|----------|---------------|-------------------|
| **JSON-LD** `<script type="application/ld+json">` de type `Recipe` | ✅ | `name`, `description`, `image[]` (plusieurs formats), `recipeYield` (`["4","poulets rôtis"]`), `prepTime`/`cookTime`/`totalTime` (ISO 8601 `PT11M`), `recipeIngredient` (chaînes pour le nombre de portions par défaut : `"1/4 càc Curry (poudre)"`), `recipeInstructions` (`HowToStep.text`), `nutrition` (`"468 kcal"`, `"8 g"`), `recipeCuisine`, `keywords`, `mainEntityOfPage` | **Élevée** : contrat SEO public (Google Rich Results) |
| **État Next.js** `<script id="__NEXT_DATA__">` → `props.pageProps.recipe` | ✅ | Tout le JSON-LD **plus** : `coversCount`, `constituents[]` structurés (`name`, `quantityPerCover`, `unit.name`, `unit.abbreviations[]`, `isOptional`), `additionalConstituents[]` (« à avoir chez soi » : huile d'olive…), `directions[].label`, `requiredTools[].name`, `nutritionalFacts[]` (`ENERC`, `FAT`, `CHOAVL`, `PRO`, `FIBTG`), `nutritionalRatingScores[]` (Nutri-Score, Green-Score), `difficulty`, `preparationTime`, `cookingTime`, `id` interne, `slug`, `tip` | **Moyenne** : structure interne, peut changer sans préavis |
| Balises OpenGraph (`og:title`, `og:image`, `og:description`, `canonical`) | ✅ | Titre, image 1200×630, URL canonique | Élevée, mais pauvre |
| API Jow (`/api/*`) | — | Non étudiée volontairement | `robots.txt` : `Disallow: /api/*` → **non utilisée** |
| DOM rendu | ✅ (SSR) | — | Faible (classes générées) → **non utilisé** en V1 |

Autres constats :

- La page est rendue côté serveur (Next.js) : un simple `GET` HTTP suffit, **aucun navigateur headless nécessaire**.
- `https://jow.fr/fr/recipes/<id>` (sans slug) répond aussi ; `/print` renvoie une page plus légère contenant aussi `__NEXT_DATA__`.
- L'URL canonique est `https://jow.fr/recipes/<slug>-<id>` (sans préfixe de langue).
- L'identifiant public est le dernier segment du chemin (`89y06dxjhfua0twu16x5`, 20 caractères `[a-z0-9]`), distinct de l'`id` interne (`5e45848c07c6a720976ed949`).
- Les quantités de `constituents` sont **par portion** et en **unité de base** (riz : `0.07` `Kilogramme` → 70 g) ; les chaînes JSON-LD sont calculées pour `coversCount` portions.
- Les `additionalConstituents` ont le nom dans `ingredient.name` (et non `name`).
- Des images de recette existent en plusieurs formats ; `https://static.jow.fr/1024x768/recipes/<hash>.jpg` est un bon compromis qualité / poids.

### 15.2 Ordre des stratégies retenu pour Jow

L'ordre demandé (JSON-LD → JSON embarqué → état sérialisé → API → DOM) est respecté en tant que **priorité de confiance**, avec une nuance : pour Jow, l'état Next.js est bien plus riche que le JSON-LD. On combine donc les deux plutôt que de s'arrêter au premier :

1. **JSON-LD** (socle garanti) → brouillon de base via le `schemaOrgMapper` générique.
2. **`__NEXT_DATA__`** (enrichissement) → validé par un schéma Zod **permissif** (`passthrough`, champs optionnels). S'il est valide, ses données structurées **remplacent** celles du socle pour : ingrédients (quantité/unité/optionnel/placard), étapes, ustensiles, nutrition, scores, difficulté, portions. S'il est absent ou invalide → on garde le socle + avertissement.
3. **OpenGraph** : complète titre/image/description/URL canonique si toujours manquants.
4. API Jow : **non utilisée**.
5. DOM : **non utilisé en V1**. Si 1 et 2 échouent, l'import échoue proprement avec les données OpenGraph en `details.partial` (proposition « Créer manuellement » pré-remplie). Un parseur DOM ne serait ajouté qu'en dernier recours si Jow supprimait à la fois JSON-LD et `__NEXT_DATA__` (peu probable : leur SEO en dépend).

### 15.3 Déroulé technique de `POST /api/imports/preview`

```
entrée { url | text }
  │
  ├─ 1. extractUrl(text)            première URL http(s) trouvée dans le texte partagé
  ├─ 2. registry.find(url)          premier importeur dont canHandle(url) = true, sinon 422 UNSUPPORTED_URL
  ├─ 3. importer.identify(url)      → { canonicalUrl, externalId } sans réseau (regex sur le chemin)
  ├─ 4. dedup(source, externalId)   si trouvé et !force → 200 { status: "duplicate" }
  ├─ 5. safeFetch(canonicalUrl)     HTTPS, hôte en liste blanche, timeout 10 s, ≤ 3 Mo, text/html, ≤ 3 redirections revalidées
  ├─ 6. importer.parse(html, url)   JSON-LD → __NEXT_DATA__ → OpenGraph → RecipeDraft + strategies + warnings
  ├─ 7. RecipeDraftSchema.parse()   validation Zod de la sortie (longueurs, bornes) ; texte assaini
  ├─ 8. suggestTags(draft)          cuisine, rapide, végétarien…
  │     suggestSeasons(keywords)    automne, hiver… (mots-clés source)
  └─ 9. log { provider, strategies, warnings, durationMs, externalId }
sortie 200 { status: "ok", draft, … }
```

### 15.4 Contrat des importeurs

```ts
interface RecipeImporter {
  readonly source: RecipeSource;                 // 'jow' | 'schema_org' | …
  canHandle(url: URL): boolean;                  // pur, sans réseau
  identify(url: URL): { canonicalUrl: string; externalId: string | null };
  parse(html: string, url: URL): ImportResult;   // pur : testable avec une fixture
}

type ImportResult = {
  draft: RecipeDraft;
  strategies: Array<'json_ld' | 'next_data' | 'open_graph'>;
  warnings: string[];
};
```

- Le téléchargement (`safeFetch`) est fait **en dehors** de l'importeur : `parse` est une fonction pure → tests unitaires sur fixtures sans réseau.
- Registre ordonné : `[JowImporter, GenericSchemaOrgImporter (V1.5)]`. Ajouter une source = ajouter une classe + ses fixtures.

### 15.5 Correspondance des champs Jow → `RecipeDraft`

| Champ brouillon | `__NEXT_DATA__` (prioritaire) | JSON-LD (socle) |
|-----------------|-------------------------------|-----------------|
| `title` | `recipe.title` | `name` |
| `description` | `recipe.description` (« Un curry tout doux, tout simple ! ») | `description` (version SEO plus longue) |
| `servings` / `servingsLabel` | `coversCount` | `recipeYield[0]` / `recipeYield[1]` |
| `prepMinutes` | `preparationTime` | `prepTime` (ISO 8601) |
| `cookMinutes` | `cookingTime` | `cookTime` |
| `totalMinutes` | prép. + cuisson | `totalTime` |
| `difficulty` | `difficulty` (1–3) | — |
| `ingredients` | `constituents[]` : `quantity = quantityPerCover × coversCount` convertie en unité canonique, `unit` depuis `unit.name`, `name`, `isOptional` ; `originalText` reconstruit (« 70 g Riz ») ; puis `additionalConstituents[]` avec `isPantry = true` | `recipeIngredient[]` passé au parseur de ligne |
| `steps` | `directions[].label` | `recipeInstructions[].text` (ou chaînes / `HowToSection`) |
| `tools` | `requiredTools[].name` | `tool[]` si présent |
| `nutrition` | `nutritionalFacts[]` (`ENERC`→kcal, `FAT`, `CHOAVL`, `PRO`, `FIBTG`) | `nutrition.*Content` (« 8 g » → 8) |
| `nutriScore` / `greenScore` | `nutritionalRatingScores[id=nutriscore/greenscore].score` | — |
| `cuisine` | `origin.name` (repli) | `recipeCuisine` (prioritaire : libellé vérifié, « Indienne ») |
| `suggestedSeasons` | `keywords[]` (« automne », « hiver »…) | `keywords` (chaîne séparée par virgules) |
| `imageSourceUrl` | — | image au format `1024x768` si présente, sinon la première |
| `sourceUrl` | — | `<link rel="canonical">` sinon URL normalisée |
| `externalId` | — | dernier segment du chemin (depuis l'URL, étape 3) |
| `sourcePayload` | `recipe` (sans `similarRecipes`) | objet JSON-LD si pas de `__NEXT_DATA__` |

Table des unités Jow (extrait, à compléter au fil des fixtures) : `Kilogramme` → g (×1000), `Gramme` → g, `Litre` → ml (×1000), `Centilitre` → ml (×10), `Millilitre` → ml, `Pièce` → `piece`, `Cuillère à soupe` → `tbsp`, `Cuillère à café` → `tsp`, `Bouquet` → `bunch`, `Pincée` → `pinch`, `Gousse` → `clove`, `Tranche` → `slice`, `Boîte` → `can`, `Sachet` → `pack`, `Brin` → `sprig`, `Feuille` → `leaf`. Unité inconnue → nom français de l'unité en minuscules (« Noisette » → `noisette` ; les abréviations Jow sont parfois en anglais : « dab »), sans conversion ni échec.

### 15.6 Détection d'un changement de structure Jow

- Chaque import journalise les stratégies utilisées. Si `next_data` disparaît des logs, c'est le signal que Jow a changé sa structure — l'import continue de fonctionner via JSON-LD, en mode dégradé.
- Un avertissement visible à l'écran de validation (« Import partiel : ustensiles et Nutri-Score non récupérés ») rend la dégradation perceptible.
- Script manuel `pnpm --filter api check:jow <url>` (V1) : télécharge une page, lance le parseur, affiche le brouillon et les avertissements. Sert à diagnostiquer et à produire une nouvelle fixture.

## 16. Stratégie de parsing

### 16.1 Extraction HTML

- Chargement avec `node-html-parser` ; lecture exclusive de `<script type="application/ld+json">`, `<script id="__NEXT_DATA__">`, `<meta property="og:*">`, `<link rel="canonical">`. **Aucun script distant n'est exécuté** (pas de navigateur, pas d'`eval`).
- JSON-LD : chaque bloc est parsé isolément (un bloc invalide n'empêche pas les autres) ; gestion des formes `@graph`, tableaux, `@type` en tableau (`["Recipe"]`).

### 16.2 Mappeur schema.org (`schemaOrgMapper`)

Réutilisé par Jow et par le futur `GenericSchemaOrgImporter`.

- Durées ISO 8601 (`PT1H15M`, `P0DT20M`) → minutes ; valeur invalide → null.
- `recipeYield` : nombre, chaîne (« 4 personnes » → 4 + libellé) ou tableau.
- `recipeInstructions` : chaîne unique (découpée par lignes), tableau de chaînes, `HowToStep`, `HowToSection` (aplatie, le nom de section devient un préfixe de la première étape).
- `image` : chaîne, tableau, `ImageObject.url`.
- Texte : suppression des balises HTML, décodage des entités, espaces normalisés, troncature aux longueurs max.

### 16.3 Parseur de ligne d'ingrédient (`parseIngredientLine`)

Objectif : pragmatique, prévisible, testé par table de cas. **Le texte original est toujours conservé**, le parseur ne fait qu'ajouter une structure « au mieux ».

Algorithme :

1. Nettoyage : espaces multiples, puces (`-`, `•`, `*`) en tête.
2. **Quantité** en tête : entier, décimal (`1,5` / `1.5`), fraction (`1/2`), fraction Unicode (`½ ¼ ¾ ⅓ ⅔`), mixte (`1 1/2`), plage (`2-3`, `2 à 3` → on retient la première valeur, le texte original garde la plage).
3. **Unité** : recherche dans un dictionnaire d'alias (insensible aux accents et à la casse, avec ou sans point) :
   - `g, gr, gramme(s)` → g ; `kg, kilo(s)` → g ×1000 ; `mg` → g ÷1000
   - `ml` → ml ; `cl` → ml ×10 ; `dl` → ml ×100 ; `l, litre(s)` → ml ×1000
   - `c. à soupe, c.à.s, càs, cas, cs, cuillère(s) à soupe, cuil. à soupe` → tbsp
   - `c. à café, c.à.c, càc, cac, cc, cuillère(s) à café` → tsp
   - `pincée(s)` → pinch ; `gousse(s)` → clove ; `tranche(s)` → slice ; `bouquet(s), bou.` → bunch ; `boîte(s)` → can ; `sachet(s)` → pack ; `brin(s)` → sprig ; `feuille(s)` → leaf ; `pièce(s)` → piece
4. Connecteurs supprimés : `de`, `d'`, `du`, `des` après l'unité.
5. **Nom** = reste de la ligne ; parenthèses conservées (« Poulet (escalope) »).
6. Quantité sans unité → `unit = piece` (« 2 carottes »). Ni quantité ni unité → `quantity = null`, `unit = null` (« sel, poivre »).
7. Indices « facultatif », « (optionnel) », « selon goût » → `isOptional = true` (le texte n'est pas modifié).

Exemples attendus (deviennent des tests) :

| Texte original | quantity | unit | nom |
|----------------|----------|------|-----|
| `2 carottes` | 2 | piece | carottes |
| `200 g de carottes` | 200 | g | carottes |
| `1 courgette` | 1 | piece | courgette |
| `huile d'olive` | null | null | huile d'olive |
| `1 c. à soupe d'huile d'olive` | 1 | tbsp | huile d'olive |
| `1/4 càc Curry (poudre)` | 0.25 | tsp | Curry (poudre) |
| `0,5 kg de pommes de terre` | 500 | g | pommes de terre |
| `20 cl de crème liquide` | 200 | ml | crème liquide |
| `½ bouquet de coriandre` | 0.5 | bunch | coriandre |
| `2 à 3 gousses d'ail` | 2 | clove | ail |
| `Sel, poivre` | null | null | Sel, poivre |

### 16.4 Ingrédient canonique

- `normalized_name` = nom en minuscules, sans accents, parenthèses retirées, apostrophes et ponctuation remplacées par des espaces, espaces fusionnés, **« s » / « x » final retiré de chaque mot** (clé seulement, jamais affichée).
  - « Carottes » et « carotte » → `carotte` ; « Choux » → `chou` ; « Huile d'olive » → `huile d olive`.
  - Les faux positifs éventuels (« ananas » → `anana`) sont sans conséquence : les deux formes produisent la même clé.
- À l'enregistrement : recherche par clé, création si absent (nom d'affichage = première occurrence, capitalisée).
- Cas des parenthèses : chez Jow, elles font partie de l'identité de l'ingrédient (« Curry (poudre) » ≠ « Curry (pâte) »), on ne peut donc pas les ignorer systématiquement. Règle retenue : **les parenthèses sont retirées de la clé uniquement pour les lignes saisies/parsées**, et conservées (normalisées) pour les ingrédients structurés Jow. Conséquence acceptée : « Poulet (escalope) » (Jow) et « poulet » (manuel) ne fusionnent pas en V1 ; la fusion manuelle d'ingrédients est prévue en V2.
- Le filtre « contient du poulet » utilise `normalized_name LIKE '%poulet%'`, il trouve donc les deux.

### 16.5 Calcul des portions (`scaleQuantity`)

- `affichée = quantity × cibles / servings`, calcul en flottant, arrondi **uniquement à l'affichage** :
  - `g`, `ml` : < 10 → 1 décimale ; < 100 → entier ; ≥ 100 → multiple de 5 ; ≥ 1 000 → `kg` / `l` avec 1–2 décimales ;
  - `piece`, `tbsp`, `tsp`, `bunch`, etc. : fraction la plus proche parmi ¼, ⅓, ½, ⅔, ¾ (sinon 1 décimale) ;
  - `quantity = null` → ligne affichée telle quelle (texte original), non recalculée.
- L'affichage recalculé reconstruit le libellé (`quantité formatée + unité + nom`) ; le texte original reste accessible (appui long ou icône info) si différent.
- Portions cibles bornées 1–50. La valeur choisie n'est jamais enregistrée dans la recette.

### 16.6 Fusion pour la liste de courses (`buildShoppingList`)

Entrée : lignes des recettes de la liste (avec facteur `servings_liste / servings_recette`) + articles manuels + clés cochées.

1. Chaque ligne est mise à l'échelle.
2. Clé de fusion :
   - `ingredient_id` connu et `quantity` non nulle → `i:<ingredient_id>|<unit>` ;
   - `ingredient_id` connu, `quantity` nulle → `i:<ingredient_id>|-` (une seule ligne « Sel » même si 3 recettes en demandent) ;
   - sinon → `t:<texte normalisé>`.
3. Addition des quantités par clé. Aucune conversion entre unités (g et pièces restent séparés).
4. Regroupement par ingrédient pour l'affichage (« Carotte : 500 g · 2 pièces »), tri alphabétique.
5. Lignes `is_pantry` → groupe « À vérifier dans le placard » ; `is_optional` → libellé « (facultatif) », fusionné avec les non-facultatives de même clé (la ligne devient non facultative).
6. `checked` = clé présente dans `shopping_list_check`.

Exemple : A « 200 g carottes » + B « 300 g carottes » → `500 g Carotte`. A « 2 carottes » + B « 300 g carottes » → deux lignes sous « Carotte ».

## 17. Gestion des erreurs

### 17.1 Codes d'erreur API

| HTTP | `code` | Cas | Message affiché (FR) |
|------|--------|-----|----------------------|
| 400 | `VALIDATION_ERROR` | Corps / paramètres invalides | Détail par champ dans le formulaire |
| 401 | `UNAUTHORIZED` | Session absente/expirée | Redirection `/login?next=…` |
| 401 | `INVALID_CREDENTIALS` | Mauvais mot de passe | « Mot de passe incorrect » |
| 404 | `NOT_FOUND` | Recette / tag inexistant | « Cette recette n'existe plus » |
| 409 | `DUPLICATE_RECIPE` | Doublon à l'enregistrement | « Cette recette existe déjà » + lien |
| 409 | `TAG_EXISTS` | Nom de tag déjà pris | « Ce tag existe déjà. Fusionner ? » |
| 413 | `PAYLOAD_TOO_LARGE` | Upload > 5 Mo, corps > 1 Mo | « Image trop volumineuse (5 Mo max) » |
| 422 | `UNSUPPORTED_URL` | Domaine non géré, URL invalide, pas de recette dans l'URL | « Ce lien n'est pas pris en charge. Seules les recettes Jow sont importables pour l'instant. » |
| 422 | `PARSE_FAILED` | Aucune recette trouvée dans la page | « Impossible de lire cette recette. » + « Créer manuellement » |
| 429 | `RATE_LIMITED` | Trop d'imports / de connexions | « Trop de tentatives, réessayez dans une minute » |
| 502 | `SOURCE_UNREACHABLE` | DNS, connexion refusée, 4xx/5xx de la source | « Jow ne répond pas (erreur 503). Réessayez plus tard. » |
| 504 | `SOURCE_TIMEOUT` | > 10 s | « Jow met trop de temps à répondre. » |
| 500 | `INTERNAL_ERROR` | Imprévu | « Erreur inattendue » (détail uniquement dans les logs) |

### 17.2 Principes

- Un middleware Hono unique transforme les erreurs typées (`AppError(code, status, message, details)`) en réponse JSON ; les erreurs inconnues deviennent `500` sans fuite de stack côté client, avec un `requestId` renvoyé (en-tête `X-Request-Id`) et journalisé.
- **Échecs non bloquants** : image impossible à télécharger → la recette est enregistrée avec `image_source_url` et sans `image_path` (avertissement) ; `__NEXT_DATA__` invalide → import en mode JSON-LD (avertissement) ; unité inconnue → libellé brut.
- Côté front : erreurs de formulaire inline ; erreurs d'action en toast discret ; erreurs de chargement de page avec bouton **Réessayer** ; perte réseau signalée par un bandeau.
- Toutes les erreurs d'import sont journalisées avec `host`, `externalId`, `code`, `durationMs`.

### 17.3 Journalisation (observabilité)

- `pino` en JSON sur stdout (collecté par Docker) ; `pino-pretty` en développement.
- Une ligne par requête (méthode, route, statut, durée, `requestId`) — sans corps ni cookie.
- Événements métier : `import.preview`, `import.duplicate`, `import.failed`, `recipe.created`, `image.download_failed`, `auth.login_failed`.
- Niveau configurable (`LOG_LEVEL`). Pas de stack d'observabilité (Prometheus, Grafana, Sentry…) : `docker logs` suffit.

## 18. Sécurité

### 18.1 Mesures communes (tous scénarios)

| Risque | Mesure |
|--------|--------|
| **SSRF** via l'import | `safeFetch` : schéma `https` uniquement ; **liste blanche d'hôtes par importeur** (Jow : `jow.fr`, `www.jow.fr` ; images : `static.jow.fr`) ; ports 443 uniquement ; redirections suivies manuellement (max 3), **chaque saut revalidé** ; timeout 10 s ; taille max 3 Mo (HTML) / 8 Mo (image) lue en flux et coupée au-delà ; `Content-Type` attendu vérifié ; pas de cookies ni d'identifiants transmis |
| SSRF (V1.5, import générique) | En plus : résolution DNS et refus des adresses privées/réservées (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, ::1, fc00::/7, fe80::/10, adresses mappées IPv4…) **au moment de la connexion** (fonction `lookup` personnalisée de l'agent HTTP, pour contrer le DNS rebinding) |
| Contenu distant malveillant | Aucun rendu HTML distant ; tout texte importé est converti en **texte brut** (balises retirées) ; React échappe l'affichage ; **aucun `dangerouslySetInnerHTML`** ; aucune exécution de script distant |
| Images piégées | Vérification des octets magiques (JPEG/PNG/WebP), extension imposée par le type détecté, nom de fichier généré (UUID) — jamais le nom fourni ; servies avec `X-Content-Type-Options: nosniff` |
| Traversée de chemin | `/images/:file` n'accepte que `^[a-f0-9-]{36}\.(jpg|png|webp)$` |
| Payloads | Validation Zod stricte de toutes les entrées ; limites de taille (corps JSON 1 Mo, 100 ingrédients, 60 étapes, longueurs de champs) |
| Abus de l'import | Rate limit en mémoire : 10 imports / min, 2 imports simultanés max ; login : 5 tentatives / min / IP |
| Injection SQL | Requêtes paramétrées via Drizzle ; la recherche `LIKE` échappe `%` et `_` |
| En-têtes | `secureHeaders` de Hono : CSP stricte (`default-src 'self'; img-src 'self' data: blob: https://static.jow.fr; …` — le domaine Jow sert uniquement à l'aperçu avant enregistrement et au repli d'image), `nosniff`, `Referrer-Policy: same-origin`, `frame-ancestors 'none'` |
| Secrets | Variables d'environnement validées au démarrage (Zod) ; `.env` hors Git ; `.env.example` documenté |

### 18.2 Deux scénarios de déploiement

**Scénario A — Réseau local uniquement (pas d'authentification).**

- Serveur sur un PC/NAS de la maison, accessible en `http://192.168.x.x:3000`.
- Avantage : aucun mot de passe, surface d'attaque minimale.
- **Limite bloquante** : sans HTTPS, le navigateur refuse le service worker → **pas de PWA installable, donc pas de Share Target** (objectif O1 non atteint). Et pas d'accès hors de la maison.
- Variante acceptable : **Tailscale** (réseau privé) + `tailscale serve` qui fournit un certificat HTTPS → PWA et partage fonctionnent, sans exposition publique, authentification optionnelle.
- Configuration : `AUTH_DISABLED=true` (explicite ; le serveur refuse de démarrer sans mot de passe sinon).

**Scénario B — Exposition Internet (recommandé)** : `https://recettes.tojicode.fr` derrière la pile Caddy « edge » existante du VPS.

- HTTPS automatique (Caddy) → PWA + Share Target opérationnels partout.
- **Authentification obligatoire** :
  - un seul mot de passe ; son empreinte (scrypt, `node:crypto`, sans dépendance native) est dans `AUTH_PASSWORD_HASH`, générée par `pnpm --filter api hash-password` ;
  - session = cookie **signé** (HMAC, `SESSION_SECRET` ≥ 32 octets), `HttpOnly`, `Secure`, `SameSite=Lax`, durée 1 an (usage personnel sur appareils de confiance) ; changer `SESSION_SECRET` révoque toutes les sessions ;
  - le partage Android ouvre la PWA par une navigation GET de premier niveau sur la même origine : le cookie est envoyé, l'import arrive connecté ;
  - protection CSRF : middleware `csrf` de Hono (vérification de l'en-tête `Origin` sur les requêtes non-GET) + corps JSON obligatoire ;
  - rate limit sur `/api/auth/login` ;
  - images `/images/*` également protégées par la session.
- Recommandé en complément : sauvegarde quotidienne de `data/` (cron VPS).

Recommandation : **scénario B**, parce que l'objectif principal (partage depuis Jow sur le S24 Ultra) exige HTTPS et que l'infrastructure existe déjà. Le coût de l'authentification est faible (≈ 150 lignes, une page).

## 19. Stratégie images

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| A. URL distante seule | Zéro stockage, zéro code | Dépendance à Jow (image supprimée/renommée = image perdue), hotlinking, ne marche pas hors-ligne, requêtes vers un tiers à chaque affichage |
| B. Téléchargement local | Pérenne, rapide, fonctionne hors-ligne (cache SW), cohérent avec « mes données » | Un peu de stockage (~100–200 Ko × 1 000 recettes ≈ 150 Mo), code de téléchargement |
| C. Hybride (distant puis local en tâche de fond) | Enregistrement instantané | Deux chemins de code, tâches de fond, états intermédiaires |

**Recommandation : B, avec repli.**

- À l'enregistrement d'une recette importée, le serveur télécharge `imageSourceUrl` (via `safeFetch`, hôte en liste blanche, ≤ 8 Mo, octets magiques vérifiés) et l'écrit dans `data/images/<uuid>.<ext>`. Durée typique < 500 ms, acceptable dans la requête.
- En cas d'échec : la recette est **quand même enregistrée**, `image_source_url` conservée, l'interface affiche l'image distante (repli) avec un avertissement ; bouton « Retélécharger l'image » sur la fiche (V1.5 : nouvelle tentative automatique).
- Format récupéré chez Jow : `1024x768` JPEG (≈ 100–150 Ko), suffisant pour mobile et desktop. **Pas de redimensionnement côté serveur en V1** (pas de dépendance `sharp`).
- Uploads manuels (photos du téléphone, souvent 4–10 Mo) : **redimensionnés dans le navigateur** avant envoi (canvas → WebP/JPEG, côté max 1 600 px, qualité 0,82) → ≈ 200–400 Ko, sans dépendance serveur.
- Suppression de la recette ou remplacement de l'image → suppression du fichier.
- Sauvegarde : le dossier `data/images/` accompagne la base.
- Pendant l'écran de validation d'import (avant enregistrement), l'aperçu affiche l'image distante directement (le navigateur la charge depuis `static.jow.fr` ; la CSP autorise ce domaine uniquement pour `img-src`).

## 20. Stratégie PWA / mobile

### 20.1 Ce qu'apporte la PWA ici (valeur réelle)

1. **Cible de partage Android** (le gain principal) : l'app apparaît dans la feuille de partage de Jow et de Chrome.
2. Icône sur l'écran d'accueil, ouverture plein écran sans barre d'URL.
3. Démarrage instantané (coque applicative en cache) et **consultation des recettes récemment ouvertes sans réseau** (cuisine, cave, magasin mal couvert).

### 20.2 Implémentation

- `vite-plugin-pwa` (mode `generateSW`, Workbox) :
  - précache de la coque applicative (HTML, JS, CSS, icônes) ;
  - cache d'exécution `CacheFirst` pour `/images/*` (limite 300 entrées) ;
  - `NetworkFirst` pour `GET /api/recipes/:id` et `GET /api/shopping-list` (repli sur le cache si hors ligne, timeout 3 s) ;
  - aucune mise en cache des requêtes d'écriture ; pas de synchronisation différée.
  - mise à jour : `registerType: 'autoUpdate'` + message discret « Nouvelle version disponible ».
- Manifest :

```json
{
  "name": "Mes recettes",
  "short_name": "Recettes",
  "start_url": "/recipes",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [ { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
             { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
             { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ],
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  },
  "shortcuts": [ { "name": "Importer", "url": "/import" }, { "name": "Courses", "url": "/shopping-list" } ]
}
```

- Route front `/share` : récupère `url`, sinon cherche une URL dans `text` puis `title` (les applications Android mettent souvent le lien dans `text`, ex. « Découvre cette recette sur Jow ! https://jow.fr/… »), puis redirige vers `/import?url=…&auto=1` (remplacement d'historique). `auto=1` lance l'analyse sans tap supplémentaire.
- `GET` est choisi plutôt que `POST` : pas besoin de gérer le partage dans le service worker, fonctionne même si le SW n'est pas encore actif, et nous ne recevons pas de fichiers.

### 20.3 Compatibilité et fallbacks

| Mécanisme | Chrome Android (S24) | Samsung Internet | Desktop | Remarque |
|-----------|----------------------|------------------|---------|----------|
| Web Share Target (PWA installée) | ✅ | ⚠️ à vérifier sur l'appareil | Chrome/Edge ✅ | Nécessite HTTPS + installation. **Recommandé : installer depuis Chrome.** |
| Bouton **Coller** (`navigator.clipboard.readText`) | ✅ (autorisation demandée une fois) | ✅ | ✅ | Fallback principal |
| URL directe `/import?url=` | ✅ | ✅ | ✅ | Pour automatisations (ex. Routines Samsung, raccourcis) |
| Favori « bookmarklet » | ⚠️ peu pratique sur mobile | ⚠️ | ✅ | Desktop uniquement : `javascript:location='https://recettes…/import?url='+encodeURIComponent(location.href)` |

À vérifier en phase 4 sur le S24 Ultra : **contenu exact partagé par l'application Jow** (URL directe, texte + URL, ou lien court/raccourci de type lien dynamique). Si un lien court est partagé, `safeFetch` suivra la redirection à condition que le domaine intermédiaire soit ajouté à la liste blanche Jow.

### 20.4 Ergonomie mobile

- Zones tactiles ≥ 44 px, actions principales dans la moitié basse de l'écran (pouce).
- **Screen Wake Lock** en mode cuisine (Chrome Android ✅), réactivé au retour sur l'onglet (`visibilitychange`).
- Clavier adapté : `inputmode="numeric"` pour portions/temps, `type="url"` pour l'import, `enterkeyhint`.
- `safe-area-inset-bottom` pour la barre de navigation (écran à bords arrondis / barre gestuelle).
- Thème clair/sombre selon le système.

## 21. UX et navigation

### 21.1 Principes

- Sobre : fond neutre, une couleur d'accent, typographie système, pas d'animations décoratives (transitions ≤ 150 ms uniquement pour le feedback, `prefers-reduced-motion` respecté).
- Rapide : squelettes de chargement plutôt que spinners plein écran, mises à jour optimistes (favori, cases cochées), listes fluides.
- Peu de clics : actions fréquentes à 1 tap (favori, cocher, portions), pas de confirmation sauf suppression.

### 21.2 Routes

| Route | Écran | Version |
|-------|-------|---------|
| `/` | Redirection vers `/recipes` | MVP |
| `/recipes` | Bibliothèque (recherche, chips, grille, bouton + flottant) | MVP |
| `/recipes/new` | Création manuelle | MVP |
| `/recipes/:id` | Fiche recette (+ mode cuisine) | MVP |
| `/recipes/:id/edit` | Modification | MVP |
| `/import` | Saisie/collage d'URL → analyse → validation | MVP |
| `/share` | Réception du partage Android → redirection `/import` | MVP |
| `/tags` | Gestion des tags | MVP |
| `/settings` | Déconnexion, export, sauvegarde, version, aide installation PWA | MVP (export en V1) |
| `/login` | Mot de passe | MVP (scénario B) |
| `/shopping-list` | Liste de courses | V1 |
| `/meal-plan` | Planning semaine | V1.5 |

### 21.3 Barre de navigation basse (mobile)

MVP / V1 (4 entrées) :

```
┌────────────┬────────────┬────────────┬────────────┐
│  Recettes  │  Importer  │  Courses   │  Réglages  │
└────────────┴────────────┴────────────┴────────────┘
```

(« Courses » apparaît en V1.) V1.5 (5 entrées) : `Recettes · Planning · Importer · Courses · Plus` (« Plus » regroupe Tags et Réglages).
Sur desktop (≥ 1024 px) : même navigation en barre latérale gauche.

### 21.4 Maquettes textuelles

**Bibliothèque (mobile)**

```
┌──────────────────────────────┐
│ 🔍 Rechercher…          [⚙]  │  ← ⚙ ouvre la feuille de filtres (pastille = nb de filtres actifs)
│ [★ Favoris][🍂 De saison][≤30 min][À tester][poulet] →   (chips défilantes)
├──────────────────────────────┤
│ ┌────────────┐ ┌────────────┐│
│ │   photo    │ │   photo    ││
│ │          ★ │ │            ││
│ │Poulet curry│ │Pâtes pesto ││
│ │15 min      │ │20 min      ││
│ │indien·rapide│ │italien    ││
│ └────────────┘ └────────────┘│
│               …          (+) │  ← bouton flottant : Importer / Nouvelle recette
├──────────────────────────────┤
│ Recettes  Importer  Courses  Réglages │
└──────────────────────────────┘
```

**Fiche recette (mobile)**

```
┌──────────────────────────────┐
│ ←                  ★  ⋮      │  ⋮ = Modifier, Statut, Supprimer, Voir la source
│ [        photo 4:3        ]  │
│ Poulet au curry              │
│ ⏱ 15 min (4 prép · 11 cuis.) · Facile · Nutri-Score A │
│ #indien #rapide              │
│ 🍂 Automne · ❄️ Hiver         │
│ [ Mode cuisine ] [ + Courses ]│
│ ── Ingrédients ──  [−] 2 pers. [+] │
│ ☐ 2 Poulet (escalope)        │
│ ☐ ½ càc Curry (poudre)       │
│ ☐ 140 g Riz                  │
│ ▸ À avoir chez soi (1)       │
│ ── Ustensiles ──             │
│ Poêle · Casserole            │
│ ── Étapes ──                 │
│ ① Versez le riz…        ☐    │
│ ② Coupez les filets…    ☐    │
│ ── Notes ──  (éditable)      │
│ ── Nutrition (par portion) ──│
└──────────────────────────────┘
```

**Écran de validation d'import**

```
┌──────────────────────────────┐
│ ← Importer                   │
│ ⚠ Import partiel : ustensiles non récupérés (si besoin)
│ [photo]  Titre [__________]  │
│ Portions [1]  Prép [4] Cuisson [11] Total [15] │
│ Tags suggérés : (indien) (rapide) (+ ajouter)  │
│ Saisons : [🌱][☀️][🍂·][❄️·] [Toute l'année]  (· = suggérée, non cochée) │
│ Ingrédients (5) ▾   Étapes (6) ▾   (repliés, éditables)
│ Source : jow.fr ↗            │
│ ┌──────────────────────────┐ │
│ │       Enregistrer        │ │  ← bouton fixe en bas, zone du pouce
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Liste de courses**

```
┌──────────────────────────────┐
│ Courses            [Vider]   │
│ 3 recettes ▸ (Poulet curry ×2p, …)  │
│ ☐ Carotte — 500 g · 2 pièces │
│ ☐ Lait de coco — 4 càs       │
│ ☑ Riz — 140 g   (barré)      │
│ + Ajouter un article         │
│ ▸ À vérifier dans le placard (3) │
│ [ Retirer les cochés ]       │
└──────────────────────────────┘
```

## 22. Stratégie de tests

Objectif : **tests utiles, pas de couverture cible**. Vitest partout.

| Priorité | Cible | Type | Détail |
|----------|-------|------|--------|
| P1 | `JowImporter.parse` | Unitaire sur fixtures HTML | Pour chaque fixture : titre, portions, temps, nb d'ingrédients, quantités converties (riz 70 g pour 1 portion), placard, optionnels, étapes, ustensiles, nutrition, scores, externalId, URL canonique |
| P1 | Dégradation Jow | Unitaire | Fixture dont `__NEXT_DATA__` est retiré → brouillon depuis JSON-LD + avertissement ; fixture sans JSON-LD ni NEXT_DATA → `PARSE_FAILED` avec partiel OpenGraph ; `__NEXT_DATA__` corrompu → pas d'exception |
| P1 | `JowImporter.canHandle/identify` | Unitaire | Variantes d'URL (§ F1), URL non-recette (`/fr/recipes`), autres domaines, `jow.fr.evil.com`, `evil.com/jow.fr/recipes/…` |
| P1 | `parseIngredientLine` | Table de cas | Tableau § 16.3 + cas limites (vide, uniquement quantité, unités avec point, majuscules, accents) |
| P1 | `scaleQuantity` / formatage | Unitaire | Doublement, division, fractions, null, arrondis g/ml, passage en kg |
| P1 | Saisons (`shared`) | Unitaire | `currentSeason` aux bornes (28/02 → hiver, 01/03 → printemps, 31/08 → été, 01/12 → hiver) ; `suggestSeasons` depuis les mots-clés (accents, anglais, « automn ») ; fixture poulet rôti → automne + hiver suggérés, curry → aucune |
| P1 | `buildShoppingList` | Unitaire | Fusion même unité, non-fusion unités différentes, quantités nulles, placard, optionnels, même recette ajoutée deux fois, clés cochées |
| P1 | `safeFetch` / validation d'URL | Unitaire (fetch simulé) | Redirection vers hôte hors liste → refus ; > 3 redirections ; dépassement de taille ; timeout ; mauvais content-type ; `http` réécrit |
| P2 | Déduplication | Intégration API (`app.request()`, SQLite en mémoire) | Preview d'une URL déjà importée → `duplicate` ; POST doublon → 409 ; POST `force: true` → 201 |
| P2 | Endpoints recettes | Intégration API | Création manuelle → détail cohérent ; PUT conserve les lignes Jow inchangées ; suppression cascade ; filtres combinés (q + tag + maxTime + ingredient + seasons) ; filtre saisons en OU, recettes sans saison exclues ; valeur de saison inconnue → 400 ; recherche sans accents |
| P2 | Auth | Intégration API | Sans cookie → 401 ; login ok/ko ; rate limit ; requête POST sans `Origin` valide → refusée |
| P3 | Front | Composant (Testing Library) | Uniquement la logique non triviale : route `/share` (extraction d'URL du texte), sélecteur de portions |

Conventions :

- Fixtures dans `apps/api/test/fixtures/jow/*.html`, nommées par slug. Ajouter une fixture à chaque bug d'import constaté (test de non-régression).
- **Aucun appel réseau réel** dans la suite de tests. Le script `check:jow` sert aux vérifications manuelles contre le vrai site.
- Base de test : SQLite `:memory:` + migrations appliquées par test (rapide).
- `pnpm test` à la racine lance tout ; exécuté avant chaque déploiement (et en CI GitHub Actions si le dépôt est poussé).

## 23. Structure du repository

Monorepo **minimal** : pnpm workspaces, 3 paquets, pas d'orchestrateur. Justification : le front et l'API ont des outils de build différents (Vite vs Node), et le paquet `shared` évite de dupliquer schémas Zod, parseur et calculs. Aller plus simple (un seul paquet) mélangerait les `tsconfig` navigateur/Node ; aller plus loin (Turborepo, paquets par domaine) n'apporterait rien.

```
mes recettes/
├── package.json                 # scripts racine : dev, build, test, lint, format, typecheck
├── pnpm-workspace.yaml
├── tsconfig.base.json           # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes (à évaluer)
├── eslint.config.js
├── .prettierrc
├── .editorconfig
├── .gitignore                   # node_modules, dist, data/, .env
├── .env.example
├── Dockerfile
├── .dockerignore
├── README.md                    # démarrage, variables, déploiement, sauvegarde
├── docs/
│   ├── specification.md
│   ├── implementation-plan.md
│   └── research/jow/*.html      # pages Jow brutes archivées (source des fixtures)
├── data/                        # (git-ignoré) app.db + images/ en local
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/             # migrations SQL générées par drizzle-kit, versionnées
│   │   ├── src/
│   │   │   ├── index.ts         # démarrage serveur (node-server), migrations au boot
│   │   │   ├── app.ts           # construction de l'app Hono (exporte AppType)
│   │   │   ├── env.ts           # variables d'environnement validées (Zod)
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   └── client.ts
│   │   │   ├── routes/          # recipes.ts, imports.ts, tags.ts, images.ts, auth.ts, shopping.ts, mealPlan.ts, system.ts
│   │   │   ├── services/        # recipeService.ts, importService.ts, tagService.ts, shoppingService.ts, imageService.ts
│   │   │   ├── importers/
│   │   │   │   ├── types.ts     # RecipeImporter, ImportResult
│   │   │   │   ├── registry.ts
│   │   │   │   ├── html.ts      # extraction JSON-LD / NEXT_DATA / OpenGraph
│   │   │   │   ├── schemaOrg/mapper.ts
│   │   │   │   └── jow/         # JowImporter.ts, nextData.ts (schéma Zod permissif), units.ts
│   │   │   ├── lib/             # safeFetch.ts, errors.ts, logger.ts, rateLimit.ts, auth.ts, text.ts
│   │   │   └── scripts/         # hash-password.ts, check-jow.ts
│   │   └── test/
│   │       ├── fixtures/jow/
│   │       └── *.test.ts
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts       # proxy /api /images, vite-plugin-pwa
│       ├── index.html
│       ├── public/icons/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx          # routes + layout (bottom nav)
│           ├── api/             # client hc<AppType>, hooks TanStack Query
│           ├── pages/           # RecipesPage, RecipePage, RecipeEditPage, ImportPage, SharePage, TagsPage, ShoppingListPage, MealPlanPage, SettingsPage, LoginPage
│           ├── components/      # RecipeCard, RecipeForm, IngredientList, StepList, ServingsStepper, TagInput, FilterSheet, BottomNav, Chip, Button, Sheet, Toast
│           ├── hooks/           # useWakeLock, useLocalChecklist, useDebounce
│           ├── lib/             # resizeImage.ts, format.ts
│           └── index.css        # Tailwind
└── packages/
    └── shared/
        ├── package.json         # exporte les sources TS directement (pas de build)
        └── src/
            ├── index.ts
            ├── schemas/         # recipe.ts, import.ts, tag.ts, shopping.ts, mealPlan.ts, errors.ts
            ├── ingredients/     # parseLine.ts, units.ts, normalize.ts, format.ts
            ├── scaling.ts
            └── shoppingList.ts
```

Remarque : le nom de dossier « mes recettes » contient une espace. C'est supporté par pnpm, Vite et Docker, mais les scripts doivent toujours citer les chemins. Les paquets s'appellent `@mes-recettes/api`, `@mes-recettes/web`, `@mes-recettes/shared`.

Variables d'environnement (`.env.example`) :

```
NODE_ENV=development
PORT=3000
DATA_DIR=./data                  # contient app.db et images/
LOG_LEVEL=info
AUTH_PASSWORD_HASH=              # scrypt, généré par `pnpm --filter api hash-password`
SESSION_SECRET=                  # ≥ 32 caractères aléatoires
AUTH_DISABLED=false              # true = pas d'authentification (scénario A uniquement)
```

## 24. Étapes de développement

Résumé (détail exécutable dans `docs/implementation-plan.md`) — chaque phase livre quelque chose d'utilisable :

| Phase | Contenu | Résultat utilisable |
|-------|---------|---------------------|
| 0 | Socle : workspace, TS strict, lint, Vitest, API Hono « health », front Vite, DB + migrations | `pnpm dev` affiche l'app vide connectée à l'API |
| 1 | Recette manuelle de bout en bout : schéma, parseur d'ingrédients, CRUD, liste, fiche, portions, upload photo | Je saisis et consulte mes recettes |
| 2 | Import Jow : safeFetch, JowImporter + fixtures, preview, écran de validation, doublons, images locales | Je colle une URL Jow et j'enregistre la recette |
| 3 | Organisation : tags (CRUD + suggestions), saisons, statut, favoris, recherche, filtres, tri, mode cuisine | Je retrouve et cuisine mes recettes confortablement |
| 4 | Mobile & mise en ligne : auth, PWA, Share Target, Dockerfile, déploiement VPS | **MVP** : Jow → Partager → Mes recettes sur le S24 |
| 5 | Liste de courses + export/sauvegarde | **V1** |
| 6 | Planning de la semaine | V1.5 (début) |
| 7 | Import générique schema.org, ré-import, « je l'ai cuisinée », hasard | V1.5 (fin) |

## 25. Critères d'acceptation

Format : chaque critère est vérifiable manuellement ou par test (T = couvert par un test automatisé).

### CA-F1 Import Jow

- [ ] En collant `https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5`, l'écran de validation affiche : titre « Poulet au curry », 1 portion, 4 min de préparation, 11 min de cuisson, 15 min au total, 5 ingrédients dont « 70 g Riz » et « ½ bouquet Coriandre (frais) » marqué facultatif, 1 ingrédient « à avoir chez soi » (Huile d'olive), 6 étapes, 3 ustensiles, 468 kcal, Nutri-Score A, Green-Score C. (T, fixture)
- [ ] La recette « Poulet rôti au miel » est importée avec 4 portions et « 1 Poulet (entier) » (0,25 × 4). (T)
- [ ] Les variantes d'URL (`/recipes/…`, `/en/recipes/…`, `/print`, `?utm=…`, `www.`, `http://`) donnent le même `externalId` et la même URL canonique. (T)
- [ ] Un texte partagé « Découvre cette recette https://jow.fr/recipes/… sur Jow » est accepté. (T)
- [ ] Une URL d'un autre site renvoie « Ce lien n'est pas pris en charge… » sans requête sortante. (T)
- [ ] Si `__NEXT_DATA__` est absent, la recette est importée depuis le JSON-LD avec un avertissement visible. (T)
- [ ] Si la page ne contient aucune recette, un message clair et un bouton « Créer manuellement » (titre/image pré-remplis si disponibles) sont proposés. (T côté API)
- [ ] L'URL source, l'identifiant Jow et la date d'import sont enregistrés et visibles (lien « Voir sur Jow »).
- [ ] Temps de l'analyse < 3 s sur connexion normale (hors lenteur Jow).
- [ ] Aucune donnée n'est enregistrée tant que je n'ai pas tapé « Enregistrer ».

### CA-F3 Bibliothèque

- [ ] La recherche « poulet » trouve les recettes dont le titre **ou** un ingrédient contient « poulet » ; « creme » trouve « Crème ». (T)
- [ ] Les filtres se combinent (ET) : `poulet` + tag `rapide` + `≤ 30 min` + favoris. (T)
- [ ] Le filtre ingrédient « poulet » trouve « Poulet (escalope) » et « blanc de poulet ». (T)
- [ ] Les recettes archivées n'apparaissent pas sans filtre explicite. (T)
- [ ] L'état des filtres est dans l'URL ; retour arrière depuis une fiche → même liste, même position de défilement.
- [ ] Sur S24 Ultra, la liste de 200 recettes défile sans saccade ; la recherche répond en < 300 ms.

### CA-F4 Fiche recette

- [ ] Passer de 1 à 3 portions affiche « 210 g Riz » ; revenir à 1 affiche « 70 g Riz » ; la base n'est pas modifiée. (T sur `scaleQuantity`)
- [ ] Les ingrédients sans quantité (« Sel, poivre ») restent inchangés quand on change les portions.
- [ ] Cocher une étape la barre ; l'état persiste si je quitte et reviens sur la fiche dans la journée, et se réinitialise via « Tout décocher ».
- [ ] En mode cuisine, l'écran ne s'éteint pas pendant 10 min sans interaction (Chrome Android).
- [ ] Favori et statut se modifient en 1 tap, avec retour visuel immédiat.
- [ ] Supprimer demande une confirmation, supprime l'image locale et ramène à la bibliothèque.

### CA-F5 / F6 Création et modification

- [ ] Une recette peut être créée avec seulement un titre.
- [ ] Coller 10 lignes d'ingrédients affiche l'aperçu d'analyse (quantité · unité · nom) pour chaque ligne.
- [ ] Modifier le titre d'une recette Jow sans toucher aux ingrédients conserve exactement les données structurées des ingrédients (placard, facultatif, quantités). (T)
- [ ] Modifier une ligne d'ingrédient la ré-analyse ; le texte saisi est conservé comme texte original. (T)
- [ ] Une photo de 8 Mo prise avec le téléphone est envoyée en < 3 s et pèse < 500 Ko côté serveur.

### CA-F7 / F8 Statut, favoris, tags

- [ ] Une recette importée a le statut « à tester » par défaut.
- [ ] Une recette peut être à la fois « validée » et favorite.
- [ ] Créer « Végétarien » alors que « vegetarien » existe est refusé (proposition de réutiliser l'existant). (T)
- [ ] Renommer un tag met à jour toutes les recettes ; renommer vers un nom existant propose la fusion et la réalise. (T)
- [ ] Supprimer un tag indique le nombre de recettes concernées et ne supprime aucune recette. (T)
- [ ] Les tags suggérés à l'import ne sont pas appliqués si je ne les coche pas.

### CA-F8b Saisons

- [ ] Je peux cocher 0, 1, 2, 3 ou 4 saisons sur une recette depuis le formulaire ; « Toute l'année » coche les 4 en 1 tap. (T sur l'API)
- [ ] Une recette avec les 4 saisons affiche « Toute l'année » ; sans saison, rien n'est affiché.
- [ ] Je modifie les saisons depuis le menu ⋮ de la fiche sans ouvrir le formulaire complet.
- [ ] Le filtre « Été + Printemps » renvoie les recettes marquées été **ou** printemps, et pas les recettes sans saison. (T)
- [ ] Une recette « toute l'année » apparaît quel que soit le filtre de saison. (T)
- [ ] Le 28/09, la chip « De saison » filtre sur l'automne. (T sur `currentSeason`)
- [ ] Saisons + tag + temps max se combinent (ET entre familles de filtres). (T)
- [ ] L'import de « Poulet rôti au miel & aux épices » suggère Automne et Hiver, non cochés ; rien n'est enregistré si je ne les coche pas. (T)
- [ ] Les filtres de saison sont reflétés dans l'URL (`/recipes?seasons=autumn,winter`).

### CA-F9 Liste de courses

- [ ] Recette A (200 g carottes) + B (300 g carottes) → une ligne « Carotte — 500 g ». (T)
- [ ] A (2 carottes) + B (300 g carottes) → « Carotte — 2 pièces · 300 g » (deux quantités distinctes). (T)
- [ ] Ajouter une recette de 2 portions pour 4 personnes double ses quantités dans la liste. (T)
- [ ] Retirer une recette de la liste retire ses quantités, les autres restent correctes. (T)
- [ ] Les coches survivent au rechargement ; « Retirer les cochés » les fait disparaître.
- [ ] Les ingrédients « à avoir chez soi » sont dans une section repliée séparée.
- [ ] Un article libre peut être ajouté, coché, supprimé.

### CA-F10 Planning (V1.5)

- [ ] Je place une recette le mardi soir pour 4 portions en ≤ 4 taps.
- [ ] Une note libre (« restes ») peut remplacer une recette.
- [ ] « Ajouter la semaine aux courses » ajoute chaque recette planifiée avec ses portions. (T)
- [ ] Supprimer une recette planifiée laisse une entrée « recette supprimée » sans erreur.

### CA-F11 Mobile / PWA

- [ ] L'app est installable depuis Chrome Android (critères Lighthouse PWA « installable » verts).
- [ ] Depuis l'app Jow **et** depuis jow.fr dans Chrome : Partager → Mes recettes → écran de validation affiché sans autre action ; Enregistrer → fiche. (≤ 3 taps au total)
- [ ] Non connecté, le partage passe par la page de connexion puis reprend l'import automatiquement.
- [ ] Une recette déjà ouverte reste consultable en mode avion.
- [ ] Le bouton « Coller » de `/import` remplit l'URL depuis le presse-papiers.

### CA-F12 Déduplication

- [ ] Réimporter une URL déjà enregistrée affiche « Cette recette existe déjà » avec « Ouvrir la recette » et « Importer quand même », **sans** requête vers Jow. (T)
- [ ] Deux URL différentes de la même recette (`/fr/recipes/slug-id` et `/recipes/id`) sont détectées comme doublon. (T)
- [ ] « Importer quand même » crée une seconde recette distincte. (T)

### CA-F13 Images

- [ ] Après import, l'image est servie depuis `/images/…` (aucune requête vers `static.jow.fr` à l'affichage de la fiche).
- [ ] Si le téléchargement de l'image échoue, la recette est quand même enregistrée et l'image distante est affichée en repli.

### CA-F14 Export / sauvegarde (V1)

- [ ] L'export JSON contient toutes les recettes avec ingrédients, étapes, tags ; il est ré-importable par un script (vérifié une fois).
- [ ] Le téléchargement de sauvegarde produit une base SQLite ouvrable et cohérente pendant que l'app tourne.

### CA-F15 Sécurité

- [ ] Sans session, toute route `/api/*` (hors health/login) et `/images/*` renvoie 401. (T)
- [ ] 6 tentatives de connexion en 1 min → 429. (T)
- [ ] Une redirection de jow.fr vers un hôte hors liste blanche est refusée. (T)
- [ ] Une réponse de plus de 3 Mo est interrompue. (T)
- [ ] Un titre importé contenant `<script>alert(1)</script>` est stocké et affiché comme texte brut. (T)
- [ ] Le serveur refuse de démarrer en production sans `AUTH_PASSWORD_HASH` ni `AUTH_DISABLED=true`.

---

## 26. Revue critique et arbitrages

Relecture effectuée après rédaction. Incohérences et complexités identifiées, et comment elles sont résolues.

### 26.1 Incohérences relevées dans le besoin et résolution

| # | Constat | Résolution retenue |
|---|---------|--------------------|
| 1 | « Favorite » figure à la fois comme statut et comme favori | Favori = booléen indépendant ; statut = cycle de vie (§ 12.3) |
| 2 | « À refaire » est ambigu (envie de refaire / à retravailler) | Non retenu comme statut en V1 — **arbitrage A1** |
| 3 | « Catégories » citées à côté des tags | Une catégorie = un tag ; pas de second système |
| 4 | Ordre d'étude « JSON-LD d'abord » alors que les données Jow les plus riches sont dans `__NEXT_DATA__` | JSON-LD = socle stable, `__NEXT_DATA__` = enrichissement validé, repli automatique (§ 15.2) |
| 5 | Endpoints publics Jow envisagés en 4ᵉ option | Écartés : `robots.txt` interdit `/api/*`, non contractuels, et inutiles puisque la page HTML suffit |
| 6 | « Réseau local sans authentification » vs « PWA + Share Target » | Incompatibles sans HTTPS : scénario B recommandé (ou Tailscale) — **arbitrage A2** |
| 7 | `MealPlan` et `ShoppingList` proposés comme entités | Supprimées (pas d'information propre) ; liste de courses calculée (§ 12.2) |
| 8 | Liste de pages sans création/édition/login/partage | Ajout de `/recipes/new`, `/recipes/:id/edit`, `/login`, `/share` |
| 9 | « Forcer un nouvel import » vs unicité en base | Index non unique, doublon vérifié par le service ; « Importer quand même » = copie (§ 12.3) |
| 10 | « Saisie manuelle » listée comme importeur | C'est le formulaire de création ; il partage le format de brouillon, pas l'interface d'importeur |
| 11 | Quantités Jow par portion vs texte affiché pour N portions | Stockage pour `servings` portions (× `coversCount`), cohérent avec l'affichage Jow et le texte original |

### 26.2 Simplifications appliquées

- Pas de Turborepo/Nx, pas de build du paquet `shared` (sources TS consommées directement par Vite et esbuild).
- Pas de Docker Compose dans le dépôt ; Docker non requis en développement.
- Pas de `sharp` : images Jow déjà dimensionnées, uploads redimensionnés dans le navigateur.
- Pas de FTS5 : `LIKE` sur une colonne normalisée suffit jusqu'à plusieurs milliers de recettes.
- Pas de table de sessions : cookie signé.
- Pas de parseur DOM, pas de navigateur headless.
- Pas de glisser-déposer dans le planning, pas d'historique de listes de courses.
- Ustensiles et nutrition en JSON plutôt qu'en tables.

### 26.3 Points nécessitant ton arbitrage

| # | Question | Recommandation |
|---|----------|----------------|
| **A1** | « À refaire » : que signifie-t-il pour toi ? | Pas de statut ; utiliser favori (envie) ou un tag « à retravailler » (amélioration) |
| **A2** | Déploiement : VPS Internet (`recettes.tojicode.fr`, auth) ou réseau local / Tailscale ? | VPS + auth : seul scénario qui rend le partage depuis Jow disponible partout sans configuration réseau |
| **A3** | Liste de courses dans le MVP ou juste après (V1) ? | Juste après (phase 5) : le MVP remplace d'abord la bibliothèque Jow |
| **A4** | Après l'analyse d'un partage : écran de validation (1 tap « Enregistrer ») ou enregistrement automatique ? | Écran de validation : évite les imports accidentels, permet de corriger ; 1 seul tap de plus |
| **A5** | Fusion d'ingrédients Jow « Poulet (escalope) » et saisie manuelle « poulet » en courses | Pas de fusion en V1 (§ 16.4) ; fusion manuelle d'ingrédients en V2 |
| **A6** | Nom de domaine / sous-domaine et place dans la pile « edge » du VPS | `recettes.tojicode.fr`, à confirmer |
| **A7** | Planning des repas | V1.5, après avoir vécu quelques semaines avec la liste de courses |
| **A8** | Saisons : une recette **sans saison renseignée** doit-elle apparaître dans « De saison » ? | Non (filtre strict), sinon les recettes importées non triées noient le résultat ; pour qu'une recette apparaisse partout, la marquer « Toute l'année ». Alternative : case « inclure les recettes sans saison » dans la feuille de filtres |

### 26.4 Décisions (28/09/2026)

Toutes les recommandations du § 26.3 sont **validées**. Elles font désormais partie de la spécification :

| # | Décision |
|---|----------|
| A1 | Pas de statut « à refaire ». Statuts : `to_try`, `validated`, `archived` + favori indépendant. « À retravailler » = un tag. |
| A2 | **Scénario B** : déploiement sur le VPS, derrière la pile Caddy « edge », avec authentification par mot de passe unique. |
| A3 | Liste de courses en V1 (phase 5), après le MVP. |
| A4 | Import par partage : écran de validation, un tap « Enregistrer ». Pas d'enregistrement automatique. |
| A5 | Pas de fusion entre ingrédients Jow structurés et ingrédients saisis en V1 ; fusion manuelle d'ingrédients en V2. |
| A6 | Domaine : `recettes.tojicode.fr`. |
| A7 | Planning des repas en V1.5 (phase 6). |
| A8 | Filtres de saison stricts : une recette sans saison n'apparaît pas dans « De saison » ; « Toute l'année » = les 4 saisons cochées. |
