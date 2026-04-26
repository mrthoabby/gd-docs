#!/usr/bin/env bash
# ============================================================
#  GD docs — Script de actualización
#
#  Qué hace (ejecutar DESPUÉS de hacer git pull manualmente):
#    1. Backup automático de la BD (borra el anterior, crea uno nuevo)
#    2. Sincroniza assets estáticos (descarga nuevos, elimina huérfanos)
#    3. Regenera config.json con las credenciales del .env
#    4. Reconstruye la imagen Docker desde el nuevo código
#    5. Corre las migraciones de BD (automático via compose)
#    6. Reinicia todos los servicios
#
#  Uso:
#    bash update.sh
#    bash update.sh --skip-backup   (no hacer backup de BD)
# ============================================================
set -euo pipefail

# ── Tiempo de inicio ────────────────────────────────────────
START_TS=$(date +%s)
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
IMAGE_NAME="gddocs:latest"
SKIP_BACKUP=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Trap: siempre muestra timing + diagnóstico al salir ──────
on_exit() {
  local exit_code=$?
  set +e

  [[ $exit_code -eq 0 ]] && return  # Éxito: el banner final ya mostró el timing

  local end_ts end_time elapsed min sec
  end_ts=$(date +%s)
  end_time=$(date '+%Y-%m-%d %H:%M:%S')
  elapsed=$((end_ts - START_TS))
  min=$((elapsed / 60))
  sec=$((elapsed % 60))

  echo ""
  echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              ❌  Proceso interrumpido                    ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  ⏱️  Inicio:      ${START_TIME}"
  echo "  ⏱️  Falló en:    ${end_time}"
  printf "  ⏱️  Tiempo:      %dm %ds\n" "$min" "$sec"
  echo ""

  if command -v docker &>/dev/null; then
    local failed
    failed=$(docker ps -a --format "{{.Names}}\t{{.Status}}" 2>/dev/null \
      | grep -iE "gddocs|minio|postgres|redis" \
      | grep -iE "unhealthy|Exited \([1-9]" \
      || true)

    if [[ -n "$failed" ]]; then
      echo -e "${YELLOW}[DIAGNÓSTICO]${NC}  Últimas líneas de contenedores con errores:"
      while IFS=$'\t' read -r cname cstatus; do
        [[ -z "$cname" ]] && continue
        echo ""
        echo -e "  ${RED}▶ ${cname}${NC}  (${cstatus})"
        echo "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"
        docker logs --tail 10 "$cname" 2>&1 \
          | while IFS= read -r line; do echo "  │  $line"; done
      done <<< "$failed"
      echo ""
    else
      echo -e "${YELLOW}[DIAGNÓSTICO]${NC}  No se detectaron contenedores con falla evidente."
      echo ""
      echo "  Para inspeccionar manualmente:"
      echo "    docker compose -f $SCRIPT_DIR/compose.yml logs --tail=30"
    fi
  fi
}
trap on_exit EXIT

# ── Verificación de espacio en disco ─────────────────────────
check_disk_space() {
  local available_kb
  available_kb=$(df -k "$REPO_ROOT" 2>/dev/null | tail -1 | awk '{print $4}' || echo 0)
  local warn_kb=$((5 * 1024 * 1024))
  local min_kb=$((2 * 1024 * 1024))
  if [[ "$available_kb" -lt "$min_kb" ]]; then
    local gb; gb=$(awk "BEGIN{printf \"%.1f\", $available_kb/1048576}")
    error "Espacio insuficiente: ${gb}GB disponibles. Necesitás al menos 2GB libres."
  elif [[ "$available_kb" -lt "$warn_kb" ]]; then
    local gb; gb=$(awk "BEGIN{printf \"%.1f\", $available_kb/1048576}")
    warn "Espacio en disco bajo: ${gb}GB disponibles. Se recomiendan 5GB+ para el build."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-backup) SKIP_BACKUP=true; shift ;;
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
echo "  ⏱️  Inicio: ${START_TIME}"
echo ""

# ── Generador de contraseñas aleatorias ─────────────────────
generate_password() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 | tr -d '=+/' | head -c 32
  else
    tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 32 | head -n 1
  fi
}

# ── Función: garantizar variable con default silencioso ─────────
# Uso: ensure_env_var VAR_NAME "default_value" | --generate
#   Si la variable ya existe en .env, no hace nada.
#   Si falta, aplica el default automáticamente sin preguntar.
ensure_env_var() {
  local var_name="$1"
  local default_val="$2"
  local current_val="${!var_name:-}"
  [[ -n "$current_val" ]] && return 0   # ya definida → OK

  # Generar contraseña aleatoria si se pide
  if [[ "$default_val" == "--generate" ]]; then
    default_val="$(generate_password)"
  fi

  echo "${var_name}=${default_val}" >> "$ENV_FILE"
  export "${var_name}=${default_val}"
  info "'${var_name}' no estaba en .env → valor asignado automáticamente."
}

# ---------- Completar variables faltantes (sin interacción) ----------
info "Verificando configuración..."
ensure_env_var "MINIO_ROOT_USER"     "gddocs"
ensure_env_var "MINIO_ROOT_PASSWORD" "--generate"
ensure_env_var "MINIO_DATA_LOCATION" "${HOME}/.gddocs/minio"
ensure_env_var "REDIS_DATA_LOCATION" "${HOME}/.gddocs/redis"
ensure_env_var "REDIS_PASSWORD"      "--generate"
ensure_env_var "ASSETS_LOCATION"     "${HOME}/.gddocs/static"

# Bug #8: Validar longitud mínima de contraseña MinIO (mínimo 8 chars según S3)
if [[ ${#MINIO_ROOT_PASSWORD} -lt 8 ]]; then
  error "MINIO_ROOT_PASSWORD debe tener al menos 8 caracteres. Editá .env y volvé a correr update.sh."
fi

success "Configuración verificada."
echo ""

# ---------- 1. Backup de BD ----------
# Primero eliminamos todos los backups anteriores, luego creamos uno
# fresco. Así siempre hay exactamente un backup: el recién hecho.
BACKUP_DIR="${HOME}/.gddocs/backups"
BACKUP_FILE=""

if [[ "$SKIP_BACKUP" == false ]]; then
  mkdir -p "$BACKUP_DIR"

  # Borrar backups anteriores antes de crear el nuevo
  # Usar find en vez de ls para evitar falla con pipefail cuando no hay archivos
  OLD_BACKUPS=$(find "$BACKUP_DIR" -maxdepth 1 -name "*.sql.gz" 2>/dev/null | wc -l)
  if [[ "$OLD_BACKUPS" -gt 0 ]]; then
    info "Eliminando ${OLD_BACKUPS} backup(s) anterior(es)..."
    find "$BACKUP_DIR" -maxdepth 1 -name "*.sql.gz" -delete 2>/dev/null || true
    success "Backups anteriores eliminados."
  fi

  info "Creando backup de la base de datos..."
  BACKUP_FILE="$BACKUP_DIR/gddocs_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

  if docker ps --format '{{.Names}}' | grep -q "gddocs_postgres"; then
    docker exec gddocs_postgres pg_dump \
      -U "${DB_USERNAME:-gddocs}" \
      "${DB_DATABASE:-gddocs}" \
      | gzip > "$BACKUP_FILE" \
      && success "Backup creado: $BACKUP_FILE" \
      || warn "Backup falló — continuando igual. Revisá manualmente."
  else
    warn "PostgreSQL no está corriendo — se omite el backup."
    BACKUP_FILE=""
  fi
  echo ""
fi

# ---------- 2. Sincronizar assets estáticos ----------
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

# ---------- 3. Regenerar config.json ----------
# El template puede haber cambiado tras el git pull manual, y también
# aseguramos que las credenciales MinIO del .env estén al día.
# IMPORTANTE: el backend lee exactamente el nombre "config.json" (no affine.config.json).
info "Regenerando configuración del servidor (config.json)..."

CONFIG_DIR="${CONFIG_LOCATION:-${HOME}/.gddocs/config}"
CONFIG_SRC="$SCRIPT_DIR/config.selfhost.json"
CONFIG_DST="${CONFIG_DIR}/config.json"
mkdir -p "${CONFIG_DIR}"

# Migración automática: si existe el archivo con el nombre incorrecto, eliminarlo
# El backend busca exactamente "config.json" — el nombre "affine.config.json" era un bug.
if [[ -f "${CONFIG_DIR}/affine.config.json" ]]; then
  warn "Encontrado 'affine.config.json' con nombre incorrecto — el backend lo ignoraba."
  warn "Eliminándolo. El nuevo 'config.json' tiene la misma configuración."
  rm -f "${CONFIG_DIR}/affine.config.json"
fi

MINIO_USER="${MINIO_ROOT_USER}"
MINIO_PASS="${MINIO_ROOT_PASSWORD}"

if command -v envsubst &>/dev/null; then
  MINIO_ROOT_USER="${MINIO_USER}" MINIO_ROOT_PASSWORD="${MINIO_PASS}" \
    envsubst < "${CONFIG_SRC}" > "${CONFIG_DST}"
else
  sed \
    -e "s|\${MINIO_ROOT_USER}|${MINIO_USER}|g" \
    -e "s|\${MINIO_ROOT_PASSWORD}|${MINIO_PASS}|g" \
    "${CONFIG_SRC}" > "${CONFIG_DST}"
fi
success "config.json actualizado: ${CONFIG_DST}"
echo ""

# ---------- 4. Reconstruir imagen ----------
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Reconstruyendo imagen Docker desde código fuente...    ║"
echo "║  Esto tarda 5-15 minutos (usa cache de capas).         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

check_disk_space
DOCKER_BUILDKIT=1 docker build \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen reconstruida: ${IMAGE_NAME}"

# Eliminar imágenes dangling (evita acumulación tras cada actualización)
docker image prune -f 2>/dev/null || true
echo ""

# Asegurar que el directorio de persistencia de Redis exista antes de levantar el contenedor
mkdir -p "${REDIS_DATA_LOCATION:-${HOME}/.gddocs/redis}"

# ---------- 5. Migraciones + reinicio ----------
info "Corriendo migraciones y reiniciando servicios..."
# Solo se recrean gddocs y gddocs_migration porque son los únicos que usan
# la imagen reconstruida. MinIO, Redis y Postgres siguen corriendo sin
# interrupción — no tiene sentido reiniciarlos en cada update.
# --wait bloquea hasta que gddocs pase su healthcheck y las migraciones terminen.
docker compose -f "$SCRIPT_DIR/compose.yml" --env-file "$ENV_FILE" \
  up -d --wait --force-recreate gddocs gddocs_migration
success "Servicios activos y migraciones completadas."

# ---------- Limpieza de imágenes antiguas del storage fs ----------
# Antes de MinIO, GD docs guardaba blobs/avatares en disco en
# ~/.gddocs/storage/. Ahora todo va a MinIO. Si existe esa carpeta
# con archivos, ofrecemos borrarla para liberar espacio.
OLD_STORAGE_DIR="${UPLOAD_LOCATION:-${HOME}/.gddocs/storage}"

if [[ -d "$OLD_STORAGE_DIR" ]]; then
  OLD_FILE_COUNT=$(find "$OLD_STORAGE_DIR" -type f 2>/dev/null | wc -l)
  if [[ "$OLD_FILE_COUNT" -gt 0 ]]; then
    OLD_SIZE=$(du -sh "$OLD_STORAGE_DIR" 2>/dev/null | cut -f1)
    echo ""
    warn "Storage anterior a MinIO detectado: ${OLD_STORAGE_DIR}/ (${OLD_FILE_COUNT} archivos, ${OLD_SIZE})"
    warn "Estos archivos del storage en disco ya NO son usados — GD docs usa MinIO ahora."
    warn "Si ya no los necesitás, borrá manualmente: rm -rf ${OLD_STORAGE_DIR}"
    echo ""
  fi
fi

# ── Resumen final con tiempos ────────────────────────────────
END_TS=$(date +%s)
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
ELAPSED=$((END_TS - START_TS))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  GD docs actualizado                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐  App:         http://localhost:${PORT:-3010}"
echo "  🪣  MinIO:       http://localhost:9001"
[[ -n "$BACKUP_FILE" ]] && echo "  💾  Backup BD:   ${BACKUP_FILE}"
echo ""
echo "  ⏱️  Inicio:      ${START_TIME}"
echo "  ⏱️  Fin:         ${END_TIME}"
printf "  ⏱️  Duración:    %dm %ds\n" "$ELAPSED_MIN" "$ELAPSED_SEC"
echo ""
echo "  📋  Ver logs:    docker compose -f $SCRIPT_DIR/compose.yml logs -f"
echo "  🛑  Detener:     docker compose -f $SCRIPT_DIR/compose.yml down"
echo ""
