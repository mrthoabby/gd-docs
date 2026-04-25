#!/usr/bin/env bash
# ============================================================
#  GD docs — Script de actualización
#
#  Qué hace:
#    1. git pull (actualiza el código)
#    2. Backup automático de la BD (por seguridad)
#    3. Sincroniza assets estáticos (descarga nuevos, elimina huérfanos)
#    4. Regenera affine.config.json con las credenciales del .env
#    5. Reconstruye la imagen Docker desde el nuevo código
#    6. Corre las migraciones de BD (automático via compose)
#    7. Reinicia todos los servicios
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

# ---------- 3. Sincronizar assets estáticos ----------
# Descarga fuentes/imágenes nuevas que se hayan agregado en esta versión
# y elimina archivos huérfanos de versiones anteriores.
# Los archivos que ya existen se saltan en segundos (sin re-descargar).
info "Sincronizando assets estáticos (fuentes e imágenes)..."
ASSETS_DIR="${ASSETS_LOCATION:-${HOME}/.gddocs/static}"
if bash "$SCRIPT_DIR/download-assets.sh" "$ASSETS_DIR" 2>/dev/null; then
  success "Assets sincronizados."
else
  warn "Algunos assets fallaron — el servidor sigue funcionando."
fi
echo ""

# ---------- 4. Regenerar affine.config.json ----------
# El template puede haber cambiado con el git pull, y también
# aseguramos que las credenciales MinIO del .env estén al día.
info "Regenerando archivo de configuración con credenciales MinIO..."

CONFIG_DIR="${CONFIG_LOCATION:-${HOME}/.gddocs/config}"
CONFIG_SRC="$SCRIPT_DIR/config.selfhost.json"
CONFIG_DST="${CONFIG_DIR}/affine.config.json"
mkdir -p "${CONFIG_DIR}"

MINIO_USER="${MINIO_ROOT_USER:-gddocs}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-}"

if [[ -z "$MINIO_PASS" ]]; then
  warn "MINIO_ROOT_PASSWORD no encontrada en .env — el config se generará con contraseña vacía."
  warn "Verificá que tu .env tenga MINIO_ROOT_PASSWORD definida."
fi

if command -v envsubst &>/dev/null; then
  MINIO_ROOT_USER="${MINIO_USER}" MINIO_ROOT_PASSWORD="${MINIO_PASS}" \
    envsubst < "${CONFIG_SRC}" > "${CONFIG_DST}"
else
  sed \
    -e "s|\${MINIO_ROOT_USER}|${MINIO_USER}|g" \
    -e "s|\${MINIO_ROOT_PASSWORD}|${MINIO_PASS}|g" \
    "${CONFIG_SRC}" > "${CONFIG_DST}"
fi
success "Configuración actualizada: ${CONFIG_DST}"
echo ""

# ---------- 5. Reconstruir imagen ----------
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

# ---------- 6. Migraciones + reinicio ----------
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
echo "  🪣  MinIO:       http://localhost:9001"
echo "  💾  Backups BD:  ${BACKUP_DIR}/"
echo ""
echo "  📋  Ver logs:    docker compose -f $SCRIPT_DIR/compose.yml logs -f"
echo "  🛑  Detener:     docker compose -f $SCRIPT_DIR/compose.yml down"
echo ""

# ---------- Limpieza de backups de BD antiguos ----------
BACKUP_COUNT=$(ls "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
if [[ "$BACKUP_COUNT" -gt 0 ]]; then
  BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
  echo "┌──────────────────────────────────────────────────────────┐"
  echo "│  🗑️  Limpieza de backups de base de datos               │"
  echo "├──────────────────────────────────────────────────────────┤"
  printf "│  Tenés %2d backup(s) de BD ocupando %s en disco.         \n" "$BACKUP_COUNT" "$BACKUP_SIZE"
  echo "│                                                           │"
  echo "│  ¿Querés borrar TODOS los backups anteriores para        │"
  echo "│  liberar espacio? (el servidor ya está actualizado,      │"
  echo "│  los backups viejos ya no son necesarios)                │"
  echo "└──────────────────────────────────────────────────────────┘"
  echo ""
  read -rp "  Borrar todos los backups de BD? [s/N]: " CLEAN_ANSWER </dev/tty
  echo ""
  case "${CLEAN_ANSWER,,}" in
    s|si|sí|y|yes)
      info "Borrando todos los backups en ${BACKUP_DIR}/ ..."
      rm -f "$BACKUP_DIR"/*.sql.gz
      success "Backups de BD eliminados. Espacio liberado."
      ;;
    *)
      info "Backups de BD conservados en: ${BACKUP_DIR}/"
      ;;
  esac
  echo ""
fi

# ---------- Limpieza de imágenes antiguas del storage fs ----------
# Antes de MinIO, GD docs guardaba blobs/avatares en disco en
# ~/.gddocs/storage/. Ahora todo va a MinIO. Si existe esa carpeta
# con archivos, ofrecemos borrarla para liberar espacio.
OLD_STORAGE_DIR="${UPLOAD_LOCATION:-${HOME}/.gddocs/storage}"

if [[ -d "$OLD_STORAGE_DIR" ]]; then
  OLD_FILE_COUNT=$(find "$OLD_STORAGE_DIR" -type f 2>/dev/null | wc -l)

  if [[ "$OLD_FILE_COUNT" -gt 0 ]]; then
    OLD_SIZE=$(du -sh "$OLD_STORAGE_DIR" 2>/dev/null | cut -f1)
    echo "┌──────────────────────────────────────────────────────────┐"
    echo "│  🖼️  Imágenes antiguas (storage anterior a MinIO)       │"
    echo "├──────────────────────────────────────────────────────────┤"
    printf "│  Se encontraron %d archivo(s) en:                       \n" "$OLD_FILE_COUNT"
    printf "│  %s (%s)                  \n" "$OLD_STORAGE_DIR" "$OLD_SIZE"
    echo "│                                                           │"
    echo "│  Estos son archivos del storage anterior basado en disco. │"
    echo "│  Ahora GD docs usa MinIO para almacenar blobs y avatares. │"
    echo "│                                                           │"
    echo "│  ⚠️  IMPORTANTE: Si acabás de migrar a MinIO por primera  │"
    echo "│  vez, estos archivos NO están en MinIO todavía. Borrá     │"
    echo "│  solo si ya re-subiste o ya no necesitás esas imágenes.   │"
    echo "└──────────────────────────────────────────────────────────┘"
    echo ""
    read -rp "  Borrar el storage antiguo en disco? [s/N]: " STORAGE_ANSWER </dev/tty
    echo ""
    case "${STORAGE_ANSWER,,}" in
      s|si|sí|y|yes)
        info "Borrando storage antiguo en ${OLD_STORAGE_DIR}/ ..."
        rm -rf "${OLD_STORAGE_DIR:?}"
        success "Storage antiguo eliminado. Espacio liberado."
        ;;
      *)
        info "Storage antiguo conservado en: ${OLD_STORAGE_DIR}/"
        info "Podés borrarlo manualmente cuando confirmes que ya no lo necesitás."
        ;;
    esac
    echo ""
  fi
fi
