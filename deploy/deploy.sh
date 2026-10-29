#!/usr/bin/env bash
# Publie le commit courant sur le VPS : le code (git archive) part par SSH, l'image est construite
# sur le VPS, puis remote-deploy.sh (compose.yml, .env, redémarrage). Pas besoin de Docker sur le
# poste. Depuis la racine du dépôt, dans Git Bash :
#   bash deploy/deploy.sh [utilisateur@hôte]
set -euo pipefail

HOST=${1:-${DEPLOY_HOST:-dylan@164.132.43.97}}
cd "$(dirname "$0")/.."

TAG=$(git rev-parse --short HEAD)
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ Modifications non commitées : elles ne sont PAS déployées (seul le commit $TAG part)."
fi
IMAGE=mes-recettes:$TAG

echo "▶ Build de $IMAGE sur $HOST"
# Contexte de build = archive du commit sur l'entrée standard ; .dockerignore s'applique.
git archive --format=tar.gz HEAD | ssh "$HOST" "docker build -t $IMAGE -"

echo "▶ Mise à jour de /srv/mes-recettes"
REMOTE_TMP=$(ssh "$HOST" mktemp -d)
scp -q deploy/compose.prod.yml deploy/env.prod.example deploy/remote-deploy.sh "$HOST:$REMOTE_TMP/"
# -t : sudo demande le mot de passe, remote-deploy.sh peut demander les clés absentes du .env.
ssh -t "$HOST" "sudo sh $REMOTE_TMP/remote-deploy.sh $IMAGE; s=\$?; rm -rf $REMOTE_TMP; exit \$s"
