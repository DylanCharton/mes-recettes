# Déploiement — recettes.tojicode.fr

Cible : le VPS et sa pile Caddy « edge » (voir `Perso/DEPLOY.md`). Une seule image Docker,
un volume `data` (SQLite + images), aucun port publié.

```
Internet ──443──▶ edge-caddy ──réseau « edge »──▶ mes-recettes:3000 ──▶ volume data (/data)
```

## 1. Une seule fois (fait le 29/09/2026)

### DNS

Zone OVH `tojicode.fr` : enregistrement `A` `recettes` → `164.132.43.97`.

### Mot de passe (sur ton poste)

```sh
pnpm --filter @mes-recettes/api hash-password      # affiche scrypt$…$…
```

Le `SESSION_SECRET` se génère directement sur le VPS :
`head -c 48 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=
'`.

### Fichiers sur le VPS

`/srv` appartient à root et `/srv/edge/sites` à `deploy` : l'installation passe par `sudo`.

```sh
sudo install -d -m 755 /srv/mes-recettes /srv/backups
sudo install -m 644 compose.yml /srv/mes-recettes/compose.yml   # deploy/compose.prod.yml
sudo tee /srv/mes-recettes/.env >/dev/null <<'EOF'
IMAGE=mes-recettes:<tag>
ADMIN_EMAIL=moi@example.fr
AUTH_PASSWORD_HASH='scrypt$…$…'
SESSION_SECRET=<48 octets aléatoires>
EOF
sudo chmod 600 /srv/mes-recettes/.env
cd /srv/mes-recettes && sudo docker compose up -d --wait
```

> Les `$` de l'empreinte doivent rester entre apostrophes dans le `.env`. Le `.env` est
> lisible par root seulement : toutes les commandes `docker compose` passent par `sudo`.

### vhost Caddy

```sh
sudo install -o deploy -g deploy -m 644 recettes.caddy /srv/edge/sites/recettes.caddy
docker exec edge-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile
```

## 2. Publier une version

Pas de registre : l'image est construite sur ton poste et transférée par SSH
(le VPS est en amd64, comme Docker Desktop : pas de build multi-plateforme).
Depuis la racine du dépôt, dans Git Bash :

```sh
bash deploy/deploy.sh            # ou : bash deploy/deploy.sh utilisateur@hôte
```

Le script construit `mes-recettes:<commit>`, la charge sur le VPS, puis y lance
`remote-deploy.sh` en `sudo` (mot de passe demandé une fois) :

- réinstalle `/srv/mes-recettes/compose.yml` depuis `compose.prod.yml` ;
- **complète** `/srv/mes-recettes/.env` d'après `env.prod.example`, sans jamais écraser une
  valeur : il demande les clés absentes (ex. `ADMIN_EMAIL`) et génère `SESSION_SECRET` s'il
  manque. L'ancien fichier est gardé dans `.env.bak` ;
- pointe `IMAGE` sur la nouvelle image, `docker compose up -d --wait`, vérifie `/api/health`.

Le `.env` de production n'est jamais recopié depuis un modèle : il contient les secrets
(`SESSION_SECRET`, empreinte du mot de passe), et les remplacer déconnecterait tout le monde.
Une nouvelle variable obligatoire s'ajoute dans `env.prod.example` (et `compose.prod.yml`) ;
le déploiement suivant la demandera.

Retour arrière : le script affiche l'image précédente ; la remettre dans `.env` (elle est
encore présente sur le VPS), puis `sudo docker compose up -d`. Les
migrations de base sont appliquées au démarrage et ne suppriment jamais de données.

## 3. Sauvegarde quotidienne

La base est copiée à chaud (API backup de SQLite), les images sont des fichiers immuables :

```sh
# /etc/cron.d/mes-recettes
30 3 * * * root cd /srv/mes-recettes && docker compose exec -T app node apps/api/dist/backup.js /data/backups 14 >> /var/log/mes-recettes-backup.log 2>&1
45 3 * * * root docker run --rm -v mes-recettes_data:/data:ro -v /srv/backups:/backup alpine tar czf /backup/mes-recettes-images.tgz -C /data images backups >> /var/log/mes-recettes-backup.log 2>&1
```

Restauration : arrêter le service, remplacer `/data/app.db` par une copie de
`/data/backups/`, relancer.

## 4. Exploitation

```sh
sudo docker compose logs -f app            # journaux JSON (pino)
sudo docker compose exec app node apps/api/dist/users.js list
sudo docker compose exec -it app node apps/api/dist/users.js reset-password <email>
```

Changer `SESSION_SECRET` puis `sudo docker compose up -d` déconnecte tous les appareils.

## 5. Comptes (depuis la version multi-comptes, 12/10/2026)

- Le compte n° 1 (administrateur) détient la bibliothèque d'avant le multi-comptes. Au premier
  démarrage, il reçoit `ADMIN_EMAIL` et `AUTH_PASSWORD_HASH` ; ces variables sont ensuite ignorées
  (changer de mot de passe se fait dans Réglages, ou avec `users.js reset-password`).
- **Mise à jour d'une installation existante** : `deploy.sh` demande `ADMIN_EMAIL` (absent du
  `.env`) avant de démarrer la nouvelle image. Toutes les sessions existantes
  sont invalidées (nouveau format de cookie) : se reconnecter avec l'e-mail et le mot de passe
  habituel.
- Inviter : Réglages → Inviter quelqu'un → lien à usage unique, valable 7 jours.
- Pas de récupération de mot de passe par e-mail : `users.js reset-password <email>` (déconnecte
  tous les appareils du compte).
