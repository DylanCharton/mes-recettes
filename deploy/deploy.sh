#!/usr/bin/env bash
# Publie le commit courant sur le VPS : build de l'image, transfert par SSH, puis remote-deploy.sh
# (compose.yml, .env, redémarrage). Depuis la racine du dépôt, dans Git Bash :
#   bash deploy/deploy.sh [utilisateur@hôte]
set -euo pipefail

HOST=${1:-${DEPLOY_HOST:-dylan@164.132.43.97}}
cd "$(dirname "$0")/.."

TAG=$(git rev-parse --short HEAD)
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ Modifications non commitées : elles partent dans l'image, taguée $TAG-dirty."
  TAG=$TAG-dirty
fi
IMAGE=mes-recettes:$TAG

echo "▶ Build de $IMAGE"
docker build -t "$IMAGE" .

echo "▶ Transfert de l'image vers $HOST"
docker save "$IMAGE" | gzip | ssh "$HOST" 'gunzip | docker load'

echo "▶ Mise à jour de /srv/mes-recettes"
REMOTE_TMP=$(ssh "$HOST" mktemp -d)
scp -q deploy/compose.prod.yml deploy/env.prod.example deploy/remote-deploy.sh "$HOST:$REMOTE_TMP/"
# -t : sudo demande le mot de passe, remote-deploy.sh peut demander les clés absentes du .env.
ssh -t "$HOST" "sudo sh $REMOTE_TMP/remote-deploy.sh $IMAGE; s=\$?; rm -rf $REMOTE_TMP; exit \$s"
