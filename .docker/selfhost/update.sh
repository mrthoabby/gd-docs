#!/usr/bin/env bash
# ============================================================
#  GD docs — Script de actualización
#
#  Qué hace:
#    1. Verifica variables requeridas en .env (las pide si faltan)
#    2. git pull (actualiza el código)
#    3. Backup automático de la BD (borra el anterior, crea uno nuevo)
#    4. Sincroniza assets estáticos (descarga nuevos, elimina huérfanos)
#    5. Regenera affine.config.json con las credenciales del .env
#    6. Reconstruye la imagen Docker desde el nuevo código
#    7. Corre las migraciones de BD (automático via compose)
#    8. Reinicia todos los servicios
#
#  Uso:
#    bash update.sh
#    bash update.sh --skip-backup   (no hacer backup de BD)
#    bash update.sh --skip-pull     (no hacer git pull)
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
SKIP_PULL=false

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

GIT_REMOTE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-backup) SKIP_BACKUP=true;    shift ;;
    --skip-pull)   SKIP_PULL=true;      shift ;;
    --remote)      GIT_REMOTE_URL="$2"; shift 2 ;;
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

# ── Función: pedir variable si no está en .env ───────────────
# Uso: require_env_var NOMBRE_VAR "Descripción" ["default_fijo"] [--generate]
#   Si la variable ya existe en .env, no hace nada.
#   Si falta:
#     - Con --generate: propone una contraseña aleatoria y deja al usuario
#       aceptarla (Enter) o escribir la suya.
#     - Con default_fijo: propone ese valor como default.
#     - Sin nada: pide el valor y no acepta vacío.
require_env_var() {
  local var_name="$1"
  local prompt_msg="$2"
  local default_val=""
  local do_generate=false

  # Parsear argumentos opcionales
  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --generate) do_generate=true; shift ;;
      *) default_val="$1"; shift ;;
    esac
  done

  # Evaluar el valor actual de la variable
  local current_val="${!var_name:-}"
  [[ -n "$current_val" ]] && return 0   # ya definida → OK

  echo ""
  warn "'${var_name}' no está definida en .env"

  # Si pedimos generar, construimos el default aleatorio
  if [[ "$do_generate" == true ]]; then
    default_val="$(generate_password)"
    echo "  🔑  Valor generado automáticamente: ${default_val}"
  fi

  local user_input=""
  while [[ -z "$user_input" ]]; do
    if [[ -n "$default_val" ]]; then
      read -rp "  ${prompt_msg} [Enter para usar el valor generado]: " user_input </dev/tty
      user_input="${user_input:-$default_val}"
    else
      read -rp "  ${prompt_msg}: " user_input </dev/tty
    fi
    [[ -z "$user_input" ]] && echo "  ⚠️  El valor no puede estar vacío. Intentá de nuevo."
  done

  # Guardar en .env y exportar
  echo "${var_name}=${user_input}" >> "$ENV_FILE"
  export "${var_name}=${user_input}"
  success "'${var_name}' guardada en .env"
}

# ---------- Verificar variables requeridas ----------
info "Verificando configuración..."
require_env_var "MINIO_ROOT_USER"     "Usuario de MinIO (Enter para 'gddocs')"  "gddocs"
require_env_var "MINIO_ROOT_PASSWORD" "Contraseña de MinIO"                     --generate
require_env_var "MINIO_DATA_LOCATION" "Ruta de datos de MinIO"                  "${HOME}/.gddocs/minio"
success "Configuración verificada."
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
# Primero eliminamos todos los backups anteriores, luego creamos uno
# fresco. Así siempre hay exactamente un backup: el recién hecho.
BACKUP_DIR="${HOME}/.gddocs/backups"
BACKUP_FILE=""

if [[ "$SKIP_BACKUP" == false ]]; then
  mkdir -p "$BACKUP_DIR"

  # Borrar backups anteriores antes de crear el nuevo
  OLD_BACKUPS=$(ls "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
  if [[ "$OLD_BACKUPS" -gt 0 ]]; then
    info "Eliminando ${OLD_BACKUPS} backup(s) anterior(es)..."
    rm -f "$BACKUP_DIR"/*.sql.gz
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
info "Regenerando configuración con credenciales MinIO..."

CONFIG_DIR="${CONFIG_LOCATION:-${HOME}/.gddocs/config}"
CONFIG_SRC="$SCRIPT_DIR/config.selfhost.json"
CONFIG_DST="${CONFIG_DIR}/affine.config.json"
mkdir -p "${CONFIG_DIR}"

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
success "Configuración actualizada: ${CONFIG_DST}"
echo ""

# ---------- 5. Reconstruir imagen ----------
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

# ---------- 6. Migraciones + reinicio ----------
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
    echo "┌──────────────────────────────────────────────────────────┐"
    echo "│  🖼️  Imágenes antiguas (storage anterior a MinIO)       │"
    echo "├──────────────────────────────────────────────────────────┤"
    printf "│  Se encontraron %d archivo(s) en:                         \n" "$OLD_FILE_COUNT"
    printf "│  %s (%s)                      \n" "$OLD_STORAGE_DIR" "$OLD_SIZE"
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
