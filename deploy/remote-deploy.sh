#!/bin/sh
# Exécuté en root sur le VPS par deploy.sh : installe compose.yml, complète le .env existant
# (sans jamais écraser une valeur), pointe IMAGE sur la nouvelle image et redémarre l'appli.
#   sudo sh remote-deploy.sh mes-recettes:<tag>
set -eu

IMAGE=$1
SRC=$(dirname "$0")
DIR=/srv/mes-recettes
ENV=$DIR/.env

install -d -m 755 "$DIR"
install -m 644 "$SRC/compose.prod.yml" "$DIR/compose.yml"
[ -f "$ENV" ] || install -m 600 /dev/null "$ENV"
chmod 600 "$ENV"
cp -p "$ENV" "$ENV.bak"

has() { grep -q "^$1=" "$ENV"; }
add() {
  # Entre apostrophes : les $ d'une empreinte scrypt ne doivent pas être interprétés par compose.
  printf "%s='%s'\n" "$1" "$2" >>"$ENV"
  echo "  + $1 ajouté à $ENV"
}

for key in $(sed -n 's/^\([A-Z_][A-Z0-9_]*\)=.*/\1/p' "$SRC/env.prod.example"); do
  has "$key" && continue
  case $key in
    IMAGE) ;;
    SESSION_SECRET) add "$key" "$(head -c 48 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')" ;;
    *)
      [ "$key" = AUTH_PASSWORD_HASH ] && echo "  (pnpm --filter @mes-recettes/api hash-password sur ton poste)"
      printf '%s absent du .env, valeur : ' "$key"
      read -r value
      case $value in
        '') echo "Abandon : $key est obligatoire, .env inchangé." >&2; mv "$ENV.bak" "$ENV"; exit 1 ;;
        *\'*) echo "Abandon : apostrophe interdite dans $key, .env inchangé." >&2; mv "$ENV.bak" "$ENV"; exit 1 ;;
      esac
      add "$key" "$value"
      ;;
  esac
done

PREVIOUS=$(sed -n 's/^IMAGE=//p' "$ENV")
if [ -n "$PREVIOUS" ]; then
  sed -i "s|^IMAGE=.*|IMAGE=$IMAGE|" "$ENV"
else
  echo "IMAGE=$IMAGE" >>"$ENV"
fi

cd "$DIR"
if ! docker compose up -d --wait; then
  echo "✘ Démarrage en échec. Retour arrière :" >&2
  echo "  cd $DIR && sudo sed -i 's|^IMAGE=.*|IMAGE=$PREVIOUS|' .env && sudo docker compose up -d" >&2
  exit 1
fi
curl -fsS https://recettes.tojicode.fr/api/health
echo
echo "✔ $IMAGE en ligne (précédente : ${PREVIOUS:-aucune} ; ancien .env : $ENV.bak)"
