# Déploiement — recettes.tojicode.fr

Cible : le VPS et sa pile Caddy « edge » (voir `Perso/DEPLOY.md`). Une seule image Docker,
un volume `data` (SQLite + images), aucun port publié.

```
Internet ──443──▶ edge-caddy ──réseau « edge »──▶ mes-recettes:3000 ──▶ volume data (/data)
```

## 1. Une seule fois

### DNS

Enregistrement `A` (et `AAAA` si IPv6) : `recettes.tojicode.fr` → IP du VPS.

### Mot de passe et secret de session (sur ton poste)

```sh
pnpm --filter @mes-recettes/api hash-password      # affiche scrypt$…$…
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

### Fichiers sur le VPS

```sh
sudo mkdir -p /srv/mes-recettes && cd /srv/mes-recettes
# compose.yml = deploy/compose.prod.yml de ce dépôt
sudo tee .env >/dev/null <<'EOF'
IMAGE=ghcr.io/<owner>/mes-recettes:<tag>
AUTH_PASSWORD_HASH='scrypt$…$…'
SESSION_SECRET=<48 octets aléatoires>
EOF
sudo chmod 600 .env
```

> Les `$` de l'empreinte doivent rester entre apostrophes dans le `.env`.

### vhost Caddy

```sh
sudo cp recettes.caddy /srv/edge/sites/recettes.caddy     # deploy/recettes.caddy
docker compose -f /srv/edge/compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## 2. Publier une version

Sur ton poste (image multi-plateforme inutile : le VPS est en amd64) :

```sh
TAG=$(git rev-parse --short HEAD)
docker build -t ghcr.io/<owner>/mes-recettes:$TAG .
docker push ghcr.io/<owner>/mes-recettes:$TAG
```

Sur le VPS :

```sh
cd /srv/mes-recettes
sed -i "s|^IMAGE=.*|IMAGE=ghcr.io/<owner>/mes-recettes:<tag>|" .env
docker compose pull && docker compose up -d
docker compose ps          # état « healthy » attendu sous 30 s
curl -fsS https://recettes.tojicode.fr/api/health
```

Retour arrière : remettre l'ancien tag dans `.env`, puis `docker compose up -d`. Les
migrations de base sont appliquées au démarrage et ne suppriment jamais de données.

## 3. Sauvegarde quotidienne

La base est copiée à chaud (API backup de SQLite), les images sont des fichiers immuables :

```sh
# /etc/cron.d/mes-recettes
30 3 * * * root cd /srv/mes-recettes && docker compose exec -T app node apps/api/dist/backup.js /data/backups 14 >> /var/log/mes-recettes-backup.log 2>&1
45 3 * * * root docker run --rm -v mes-recettes_data:/data:ro -v /srv/backups:/backup alpine tar czf /backup/mes-recettes-images.tgz -C /data images backups
```

Restauration : arrêter le service, remplacer `/data/app.db` par une copie de
`/data/backups/`, relancer.

## 4. Exploitation

```sh
docker compose logs -f app                 # journaux JSON (pino)
docker compose exec app node apps/api/dist/hash-password.js   # nouveau mot de passe
```

Changer `SESSION_SECRET` puis `docker compose up -d` déconnecte tous les appareils.
