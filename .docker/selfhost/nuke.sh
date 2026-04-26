#!/usr/bin/env bash
# ============================================================
#  GD docs — NUKE: borrado total y reinstalación desde cero
#
#  ⚠️  DESTRUYE todos los datos (BD, uploads, config, MinIO).
#      Usa solo cuando quieres empezar completamente de nuevo.
#
#  Qué hace:
#    1. Para y elimina TODOS los contenedores de gddocs
#    2. Borra TODOS los volúmenes de gddocs (BD, MinIO, config)
#    3. Borra la imagen Docker gddocs:latest
#    4. git pull para bajar los últimos cambios
#    5. Genera nuevo .env con credenciales nuevas
#    6. Genera affine.config.json con credenciales MinIO
#    7. Descarga assets estáticos
#    8. Reconstruye la imagen desde cero (--no-cache)
#    9. Levanta todos los servicios y espera que estén sanos
#
#  Uso:
#    bash nuke.sh              # pide confirmación
#    bash nuke.sh --yes        # sin preguntar (para CI/scripts)
#    bash nuke.sh --skip-pull  # no hace git pull
#    bash nuke.sh --port 8080  # usa otro puerto
# ============================================================
set -euo pipefail

# ── Tiempo de inicio ─────────────────────────────────────────
START_TS=$(date +%s)
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
IMAGE_NAME="gddocs:latest"
DATA_ROOT="$HOME/.gddocs"
COMPOSE_FILE="$SCRIPT_DIR/compose.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
banner()  { echo -e "${BOLD}$*${NC}"; }

# ── Trap: timing + diagnóstico en fallo ──────────────────────
on_exit() {
  local exit_code=$?
  set +e
  [[ $exit_code -eq 0 ]] && return

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
      echo "    docker compose -f $COMPOSE_FILE logs --tail=30"
    fi
  fi
}
trap on_exit EXIT

# ---------- Argumentos ----------
AUTO_YES=false
SKIP_PULL=false
PORT=3010
GIT_REMOTE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)    AUTO_YES=true;     shift ;;
    --skip-pull) SKIP_PULL=true;    shift ;;
    --port)      PORT="$2";         shift 2 ;;
    --remote)    GIT_REMOTE_URL="$2"; shift 2 ;;
    *) warn "Argumento desconocido: $1"; shift ;;
  esac
done

echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          ⚠️   GD docs — NUKE / REINSTALACIÓN TOTAL       ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  ⏱️  Inicio: ${START_TIME}"
echo ""
echo -e "  ${BOLD}Esto va a:${NC}"
echo "    • Parar y eliminar todos los contenedores de gddocs"
echo "    • BORRAR todos los datos (BD, MinIO, config, assets)"
echo "    • Borrar la imagen Docker ($IMAGE_NAME)"
echo "    • Bajar el código más nuevo (git pull)"
echo "    • Reconstruir TODO desde cero (~15-25 min)"
echo ""
echo -e "  ${RED}${BOLD}¡NO HAY VUELTA ATRÁS PARA LOS DATOS!${NC}"
echo ""

if [[ "$AUTO_YES" == false ]]; then
  read -r -p "  ¿Estás seguro? Escribí 'SI' para continuar: " CONFIRM
  if [[ "$CONFIRM" != "SI" ]]; then
    echo ""
    echo "  Operación cancelada."
    echo ""
    exit 0
  fi
fi

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── FASE 1: Detener y eliminar contenedores ───────────────────
banner ""
banner "  FASE 1 — Deteniendo contenedores..."
banner ""

if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
  docker compose -f "$COMPOSE_FILE" down --remove-orphans --volumes 2>/dev/null || true
  success "Servicios detenidos y volúmenes de compose eliminados."
else
  info "No hay servicios corriendo via compose."
fi

# Eliminar contenedores sueltos con nombre gddocs_ (restos de pruebas manuales)
for cname in gddocs_server gddocs_migration gddocs_postgres gddocs_redis gddocs_minio gddocs_minio_init; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${cname}$"; then
    docker rm -f "$cname" 2>/dev/null || true
    info "Contenedor '$cname' eliminado."
  fi
done
success "Contenedores limpiados."

# ── FASE 2: Borrar imagen ────────────────────────────────────
banner ""
banner "  FASE 2 — Borrando imagen Docker..."
banner ""

if docker image inspect "$IMAGE_NAME" &>/dev/null; then
  docker rmi -f "$IMAGE_NAME" 2>/dev/null || true
  success "Imagen '$IMAGE_NAME' eliminada."
else
  info "Imagen '$IMAGE_NAME' no existía."
fi
docker image prune -f 2>/dev/null || true

# ── FASE 3: Borrar datos locales ─────────────────────────────
banner ""
banner "  FASE 3 — Borrando datos locales ($DATA_ROOT)..."
banner ""

if [[ -d "$DATA_ROOT" ]]; then
  rm -rf "$DATA_ROOT"
  success "Datos locales eliminados: $DATA_ROOT"
else
  info "No existía $DATA_ROOT."
fi

if [[ -f "$ENV_FILE" ]]; then
  rm -f "$ENV_FILE"
  info ".env eliminado — se generará uno nuevo."
fi

success "Sistema limpio. Todo borrado."

# ── FASE 4: git pull ─────────────────────────────────────────
if [[ "$SKIP_PULL" == false ]]; then
  banner ""
  banner "  FASE 4 — Bajando últimos cambios del repositorio..."
  banner ""
  cd "$REPO_ROOT"

  if git rev-parse --git-dir &>/dev/null; then
    if [[ -n "$GIT_REMOTE_URL" ]]; then
      git remote set-url origin "$GIT_REMOTE_URL"
      info "Remote actualizado a: $GIT_REMOTE_URL"
    fi

    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "(sin remote configurado)")
    info "Jalando desde: ${CURRENT_REMOTE}"
    git pull || warn "git pull falló — continuando con el código actual."
    success "Código actualizado."
    echo "  Último commit: $(git log -1 --oneline)"
    echo ""
  else
    warn "No es un repositorio git — se omite el pull."
  fi
fi

# ── FASE 5: Generar .env nuevo con credenciales frescas ──────
banner ""
banner "  FASE 5 — Generando configuración nueva..."
banner ""

generate_password() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 | tr -d '=+/' | head -c 32
  else
    tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 32 | head -n 1
  fi
}

DB_PASSWORD=$(generate_password)
MINIO_ROOT_PASSWORD=$(generate_password)

mkdir -p "${DATA_ROOT}"/{postgres/pgdata,config,static/fonts,static/ppt-images/background,minio}

cat > "$ENV_FILE" << EOF
# GD docs — Configuración generada el $(date -u '+%Y-%m-%d %H:%M UTC')
# (generada por nuke.sh — reinstalación completa)

PORT=${PORT}

# Rutas de datos
DB_DATA_LOCATION=${DATA_ROOT}/postgres/pgdata
CONFIG_LOCATION=${DATA_ROOT}/config
ASSETS_LOCATION=${DATA_ROOT}/static

# Base de datos
DB_USERNAME=gddocs
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=gddocs

# MinIO — almacenamiento de objetos
MINIO_ROOT_USER=gddocs
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_DATA_LOCATION=${DATA_ROOT}/minio

# Rendimiento
NODE_OPTIONS=--max-old-space-size=4096
EOF

success ".env generado."
echo ""
echo -e "  ${YELLOW}⚠️  Guardá estas contraseñas en un lugar seguro:${NC}"
echo "       BD:     ${DB_PASSWORD}"
echo "       MinIO:  ${MINIO_ROOT_PASSWORD}"
echo ""

# Cargar el .env recién creado
set -a; source "$ENV_FILE"; set +a

# ── FASE 6: Generar affine.config.json con credenciales MinIO ─
banner ""
banner "  FASE 6 — Generando affine.config.json..."
banner ""

CONFIG_DIR="${DATA_ROOT}/config"
CONFIG_SRC="$SCRIPT_DIR/config.selfhost.json"
CONFIG_DST="${CONFIG_DIR}/affine.config.json"

if command -v envsubst &>/dev/null; then
  MINIO_ROOT_USER="gddocs" MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD}" \
    envsubst < "${CONFIG_SRC}" > "${CONFIG_DST}"
else
  sed \
    -e "s|\${MINIO_ROOT_USER}|gddocs|g" \
    -e "s|\${MINIO_ROOT_PASSWORD}|${MINIO_ROOT_PASSWORD}|g" \
    "${CONFIG_SRC}" > "${CONFIG_DST}"
fi
success "Configuración generada: ${CONFIG_DST}"

# ── FASE 7: Descargar assets estáticos ───────────────────────
banner ""
banner "  FASE 7 — Descargando assets estáticos..."
banner ""

if bash "$SCRIPT_DIR/download-assets.sh" "${DATA_ROOT}/static" 2>/dev/null; then
  success "Assets estáticos listos."
else
  warn "Algunos assets fallaron — el editor funciona igual."
fi

# ── FASE 8: Construir imagen desde cero ──────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FASE 8 — Construyendo imagen desde CERO (sin cache)    ║${NC}"
echo -e "${CYAN}║  Esto tarda 15-25 minutos. No cierres la terminal.      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

DOCKER_BUILDKIT=1 docker build \
  --no-cache \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen construida: ${IMAGE_NAME}"
docker image prune -f 2>/dev/null || true

# ── FASE 9: Levantar servicios ───────────────────────────────
echo ""
banner "  FASE 9 — Levantando todos los servicios..."
echo ""

info "Iniciando GD docs (esperando que todos los servicios sean saludables)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --wait

# ── Resumen final ────────────────────────────────────────────
END_TS=$(date +%s)
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
ELAPSED=$((END_TS - START_TS))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        ✅  GD docs reinstalado desde cero                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  🌐  Abrí en el browser:  http://localhost:${PORT}"
echo "  🪣  Consola MinIO:       http://localhost:9001"
echo "       Usuario: gddocs"
echo ""
echo "  El primer usuario que se registre queda como administrador."
echo ""
echo "  ⏱️  Inicio:      ${START_TIME}"
echo "  ⏱️  Fin:         ${END_TIME}"
printf "  ⏱️  Duración:    %dm %ds\n" "$ELAPSED_MIN" "$ELAPSED_SEC"
echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  📋  Ver logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "  🛑  Detener:     docker compose -f $COMPOSE_FILE down"
echo "  ♻️   Actualizar:  bash $SCRIPT_DIR/update.sh"
echo "  ─────────────────────────────────────────────────────────"
echo ""
