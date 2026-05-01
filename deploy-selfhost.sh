#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_SCRIPT="$ROOT_DIR/.docker/selfhost/update.sh"
DO_PULL=false
ARGS=()

usage() {
  cat <<'EOF'
Uso:
  ./deploy-selfhost.sh [opciones]

Flujo normal en el servidor:
  git pull origin
  ./deploy-selfhost.sh

Opciones:
  --pull          Ejecuta git pull --ff-only antes del deploy.
  --skip-backup   No crea backup de PostgreSQL antes del update.
  --no-cache      Reconstruye la imagen Docker sin cache.
  --skip-build    Usa la imagen Docker local existente.
  --logs          Sigue los logs de gddocs al terminar.
  -h, --help      Muestra esta ayuda.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --pull)
      DO_PULL=true
      ;;
    --skip-backup|--no-cache|--skip-build|--logs)
      ARGS+=("$arg")
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Opcion desconocida: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ "$DO_PULL" == true ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[ERROR] Hay cambios locales sin commit. Haz commit/stash o ejecuta git status antes de --pull." >&2
    exit 1
  fi

  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git pull --ff-only origin "$BRANCH"
fi

exec bash "$UPDATE_SCRIPT" "${ARGS[@]}"
