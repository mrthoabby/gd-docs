#!/usr/bin/env bash
# ============================================================
#  GD docs — Script de actualización
#
#  Qué hace:
#    1. git pull (actualiza el código)
#    2. Backup automático de la BD (por seguridad)
#    3. Reconstruye la imagen Docker desde el nuevo código
#    4. Corre las migraciones de BD (automático via compose)
#    5. Reinicia todos los servicios
#
#  Uso:
#    bash update.sh
#    bash update.sh --skip-backup   (no hacer backup de BD)
#    bash update.sh --skip-pull     (no hacer git pull)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
IMAGE_NAME="gddocs:latest"
SKIP_BACKUP=false
SKIP_PULL=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

GIT_REMOTE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-backup) SKIP_BACKUP=true;       shift ;;
    --skip-pull)   SKIP_PULL=true;         shift ;;
    --remote)      GIT_REMOTE_URL="$2";    shift 2 ;;
    *) shift ;;
  esac
done

[[ -f "$ENV_FILE" ]] || error "No se encontró .env. Ejecutá install.sh primero."

# Cargar variables del .env
set -a; source "$ENV_FILE"; set +a

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              GD docs — Actualizador                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ---------- 1. git pull ----------
if [[ "$SKIP_PULL" == false ]]; then
  info "Actualizando código desde el repositorio..."
  cd "$REPO_ROOT"

  if [[ -n "$GIT_REMOTE_URL" ]]; then
    git remote set-url origin "$GIT_REMOTE_URL"
    info "Remote actualizado a: $GIT_REMOTE_URL"
  fi

  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "(sin remote)")
  info "Jalando desde: ${CURRENT_REMOTE}"

  git pull || warn "git pull falló — continuando con el código actual."
  success "Código actualizado."
  echo "  Último commit: $(git log -1 --oneline)"
  echo ""
fi

# ---------- 2. Backup de BD ----------
BACKUP_DIR="${HOME}/.gddocs/backups"
if [[ "$SKIP_BACKUP" == false ]]; then
  info "Haciendo backup de la base de datos antes de actualizar..."
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/gddocs_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

  if docker ps --format '{{.Names}}' | grep -q "gddocs_postgres"; then
    docker exec gddocs_postgres pg_dump \
      -U "${DB_USERNAME:-gddocs}" \
      "${DB_DATABASE:-gddocs}" \
      | gzip > "$BACKUP_FILE" \
      && success "Backup guardado: $BACKUP_FILE" \
      || warn "Backup falló — continuando igual. Revisá manualmente."

    # Mantener solo los últimos 5 backups
    ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
  else
    warn "PostgreSQL no está corriendo — se omite el backup."
  fi
  echo ""
fi

# ---------- 3. Reconstruir imagen ----------
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Reconstruyendo imagen Docker desde código fuente...    ║"
echo "║  Esto tarda 5-15 minutos (usa cache de capas).         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

docker build \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen reconstruida: ${IMAGE_NAME}"

# Eliminar imágenes dangling (evita acumulación tras cada actualización)
docker image prune -f 2>/dev/null || true
echo ""

# ---------- 4. Migraciones + reinicio ----------
# El servicio gddocs_migration corre automáticamente antes que gddocs
# gracias a la condición 'service_completed_successfully' en compose.yml.
# docker compose up -d recrea los contenedores con la nueva imagen
# y ejecuta las migraciones en el orden correcto.
info "Corriendo migraciones y reiniciando servicios..."
docker compose -f "$SCRIPT_DIR/compose.yml" --env-file "$ENV_FILE" up -d --force-recreate

# Esperar que la migración termine antes de reportar éxito
info "Verificando migraciones..."
sleep 5
MIGRATION_EXIT=$(docker inspect gddocs_migration --format='{{.State.ExitCode}}' 2>/dev/null || echo "0")
if [[ "$MIGRATION_EXIT" == "0" ]]; then
  success "Migraciones completadas correctamente."
else
  error "La migración falló (exit code: $MIGRATION_EXIT). Revisá los logs:\n  docker logs gddocs_migration"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  GD docs actualizado                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐  App:         http://localhost:${PORT:-3010}"
echo "  💾  Backups BD:  ${BACKUP_DIR}/"
echo ""
echo "  📋  Ver logs:    docker compose -f $SCRIPT_DIR/compose.yml logs -f"
echo "  🛑  Detener:     docker compose -f $SCRIPT_DIR/compose.yml down"
echo ""

# ---------- Limpieza de backups antiguos ----------
BACKUP_COUNT=$(ls "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
if [[ "$BACKUP_COUNT" -gt 0 ]]; then
  BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
  echo "┌──────────────────────────────────────────────────────────┐"
  echo "│  🗑️  Limpieza de backups                                 │"
  echo "├──────────────────────────────────────────────────────────┤"
  printf "│  Tienes %2d backup(s) ocupando %s en disco.              \n" "$BACKUP_COUNT" "$BACKUP_SIZE"
  echo "│                                                           │"
  echo "│  ¿Querés borrar TODOS los backups anteriores para        │"
  echo "│  liberar espacio? (el servidor ya está actualizado,      │"
  echo "│  los backups viejos ya no son necesarios)                │"
  echo "└──────────────────────────────────────────────────────────┘"
  echo ""
  read -rp "  Borrar todos los backups? [s/N]: " CLEAN_ANSWER
  echo ""
  case "${CLEAN_ANSWER,,}" in
    s|si|sí|y|yes)
      info "Borrando todos los backups en ${BACKUP_DIR}/ ..."
      rm -f "$BACKUP_DIR"/*.sql.gz
      success "Backups eliminados. Espacio liberado."
      ;;
    *)
      info "Backups conservados en: ${BACKUP_DIR}/"
      ;;
  esac
  echo ""
fi
