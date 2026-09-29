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

```sh
TAG=$(git rev-parse --short HEAD)
docker build -t mes-recettes:$TAG .
docker save mes-recettes:$TAG | gzip | ssh dylan@164.132.43.97 'gunzip | docker load'
```

Sur le VPS :

```sh
cd /srv/mes-recettes
sudo sed -i "s|^IMAGE=.*|IMAGE=mes-recettes:<tag>|" .env
sudo docker compose up -d --wait        # « healthy » attendu sous 30 s
curl -fsS https://recettes.tojicode.fr/api/health
```

Retour arrière : remettre l'ancien tag dans `.env` (image encore présente sur le VPS),
puis `sudo docker compose up -d`. Les
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
sudo docker compose exec app node apps/api/dist/hash-password.js   # nouveau mot de passe
```

Changer `SESSION_SECRET` puis `sudo docker compose up -d` déconnecte tous les appareils.
