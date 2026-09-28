# Fixtures Jow

Pages HTML réelles téléchargées le 27/09/2026 (voir `docs/research/jow/`) et variantes dégradées
dérivées de `poulet-au-curry-…` pour tester les replis de l'importeur :

- `degraded-no-next-data.html` : `__NEXT_DATA__` supprimé (repli JSON-LD).
- `degraded-open-graph-only.html` : ni `__NEXT_DATA__` ni JSON-LD (échec avec données partielles).
- `degraded-corrupted-next-data.html` : `constituents` remplacé par une chaîne (schéma invalide).

Ajouter une fixture à chaque bug d'import constaté (`pnpm --filter @mes-recettes/api check:jow <url> --save`).
