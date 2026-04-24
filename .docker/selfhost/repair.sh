#!/usr/bin/env bash
# ============================================================
#  GD docs — Reparación inteligente
#
#  Inspecciona cada componente y solo arregla lo que está roto.
#  NO borra datos ni reconstruye si todo está bien.
#
#  Qué hace:
#    1. Verifica que exista la imagen Docker
#    2. Verifica postgres y redis (infraestructura base)
#    3. Verifica la migración de BD
#    4. Verifica el servidor principal
#    Solo interviene donde detecta un problema.
#
#  Uso:
#    bash repair.sh                   # revisión y reparación automática
#    bash repair.sh --rebuild         # forzar rebuild de imagen (sin borrar datos)
#    bash repair.sh --status          # solo mostrar estado, sin tocar nada
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
IMAGE_NAME="gddocs:latest"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

FORCE_REBUILD=false
STATUS_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild)     FORCE_REBUILD=true;  shift ;;
    --status)      STATUS_ONLY=true;    shift ;;
    *) warn "Argumento desconocido: $1"; shift ;;
  esac
done

[[ -f "$ENV_FILE" ]] || { error "No hay .env. Ejecutá install.sh primero."; exit 1; }
set -a; source "$ENV_FILE"; set +a

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              GD docs — Reparación inteligente            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Helpers de estado ────────────────────────────────────────

container_status() {
  docker inspect "$1" --format='{{.State.Status}}' 2>/dev/null || echo "missing"
}

container_health() {
  docker inspect "$1" --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo "missing"
}

container_exit_code() {
  docker inspect "$1" --format='{{.State.ExitCode}}' 2>/dev/null || echo "-1"
}

container_restarts() {
  docker inspect "$1" --format='{{.RestartCount}}' 2>/dev/null || echo "0"
}

image_exists() {
  docker image inspect "$IMAGE_NAME" &>/dev/null
}

# ── Recolectar estado actual ─────────────────────────────────

header "  Diagnóstico del sistema"
echo ""

IMG_OK=false
image_exists && IMG_OK=true

PG_STATUS=$(container_status "gddocs_postgres")
PG_HEALTH=$(container_health "gddocs_postgres")
REDIS_STATUS=$(container_status "gddocs_redis")
REDIS_HEALTH=$(container_health "gddocs_redis")
MIG_STATUS=$(container_status "gddocs_migration")
MIG_EXIT=$(container_exit_code "gddocs_migration")
SRV_STATUS=$(container_status "gddocs_server")
SRV_RESTARTS=$(container_restarts "gddocs_server")

# Mostrar tabla de estado
print_state() {
  local name="$1" status="$2" detail="$3"
  local icon color
  case "$status" in
    running|healthy)         icon="✅"; color="$GREEN" ;;
    exited_ok)               icon="✅"; color="$GREEN" ;;
    starting|unhealthy|none) icon="⏳"; color="$YELLOW" ;;
    *)                       icon="❌"; color="$RED" ;;
  esac
  printf "  ${color}${icon}${NC}  %-22s %s\n" "$name" "$detail"
}

if $IMG_OK; then
  print_state "imagen Docker"  "healthy"   "gddocs:latest existe"
else
  print_state "imagen Docker"  "missing"   "no existe — hay que construirla"
fi

if [[ "$PG_STATUS" == "running" && "$PG_HEALTH" == "healthy" ]]; then
  print_state "PostgreSQL"     "healthy"   "running + healthy"
else
  print_state "PostgreSQL"     "$PG_STATUS" "status=$PG_STATUS health=$PG_HEALTH"
fi

if [[ "$REDIS_STATUS" == "running" && "$REDIS_HEALTH" == "healthy" ]]; then
  print_state "Redis"          "healthy"   "running + healthy"
else
  print_state "Redis"          "$REDIS_STATUS" "status=$REDIS_STATUS health=$REDIS_HEALTH"
fi

if [[ "$MIG_STATUS" == "exited" && "$MIG_EXIT" == "0" ]]; then
  print_state "Migración BD"   "exited_ok" "completada (exit 0)"
elif [[ "$MIG_STATUS" == "missing" ]]; then
  print_state "Migración BD"   "missing"   "nunca corrió"
else
  print_state "Migración BD"   "failed"    "status=$MIG_STATUS exit=$MIG_EXIT"
fi

if [[ "$SRV_STATUS" == "running" && "$SRV_RESTARTS" == "0" ]]; then
  print_state "Servidor GD"    "healthy"   "running estable"
elif [[ "$SRV_STATUS" == "running" && "$SRV_RESTARTS" -gt 0 ]]; then
  print_state "Servidor GD"    "unhealthy" "running pero con $SRV_RESTARTS reinicios"
elif [[ "$SRV_STATUS" == "restarting" ]]; then
  print_state "Servidor GD"    "failed"    "crash loop (restarting)"
else
  print_state "Servidor GD"    "$SRV_STATUS" "status=$SRV_STATUS"
fi

echo ""

if $STATUS_ONLY; then
  echo "  (modo --status: no se hacen cambios)"
  echo ""
  exit 0
fi

# ── Determinar qué hay que reparar ──────────────────────────

NEED_BUILD=false
NEED_INFRA=false
NEED_MIGRATION=false
NEED_SERVER=false
ALL_OK=true

if ! $IMG_OK || $FORCE_REBUILD; then
  NEED_BUILD=true
  ALL_OK=false
fi

if [[ "$PG_STATUS" != "running" || "$PG_HEALTH" != "healthy" ]] || \
   [[ "$REDIS_STATUS" != "running" || "$REDIS_HEALTH" != "healthy" ]]; then
  NEED_INFRA=true
  ALL_OK=false
fi

if [[ "$MIG_STATUS" != "exited" || "$MIG_EXIT" != "0" ]]; then
  NEED_MIGRATION=true
  ALL_OK=false
fi

if [[ "$SRV_STATUS" != "running" ]] || \
   [[ "$SRV_STATUS" == "running" && "$SRV_RESTARTS" -gt 3 ]] || \
   [[ "$SRV_STATUS" == "restarting" ]]; then
  NEED_SERVER=true
  ALL_OK=false
fi

# Si el servidor está en crash loop, hay que rebuildar la imagen
# (casi siempre es un bug de código recién desplegado)
if [[ "$SRV_STATUS" == "restarting" ]] || \
   [[ "$SRV_STATUS" == "running" && "$SRV_RESTARTS" -gt 3 ]]; then
  NEED_BUILD=true
fi

if $ALL_OK; then
  success "Todo está funcionando correctamente. No hay nada que reparar."
  echo ""
  echo "  🌐  App: http://localhost:${PORT:-3010}"
  echo ""
  exit 0
fi

# ── Ejecutar reparaciones ────────────────────────────────────

# ── 1. Imagen ────────────────────────────────────────────────
if $NEED_BUILD; then
  header "  Paso 1 — Reconstruyendo imagen Docker"
  if $FORCE_REBUILD; then
    warn "Rebuild forzado por --rebuild"
  elif [[ "$SRV_STATUS" == "restarting" ]]; then
    warn "Servidor en crash loop — rebuildeando imagen con el código actual"
  else
    info "Imagen no encontrada — construyendo..."
  fi
  echo ""
  docker build \
    -f "$SCRIPT_DIR/Dockerfile.selfhost" \
    -t "$IMAGE_NAME" \
    "$REPO_ROOT"
  docker image prune -f 2>/dev/null || true
  success "Imagen reconstruida: ${IMAGE_NAME}"
else
  info "Paso 1 — Imagen OK, se omite el build"
fi

# ── 2. Infraestructura base ──────────────────────────────────
if $NEED_INFRA; then
  header "  Paso 2 — Reparando infraestructura (postgres + redis)"

  PG_BAD=false
  REDIS_BAD=false

  [[ "$PG_STATUS" != "running" || "$PG_HEALTH" != "healthy" ]] && PG_BAD=true
  [[ "$REDIS_STATUS" != "running" || "$REDIS_HEALTH" != "healthy" ]] && REDIS_BAD=true

  if $PG_BAD && $REDIS_BAD; then
    info "Levantando postgres y redis..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis
  elif $PG_BAD; then
    info "Reiniciando postgres..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
  else
    info "Reiniciando redis..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d redis
  fi

  # Esperar que estén healthy
  info "Esperando que la BD esté lista..."
  for i in $(seq 1 30); do
    sleep 2
    PG_NOW=$(container_health "gddocs_postgres")
    REDIS_NOW=$(container_health "gddocs_redis")
    if [[ "$PG_NOW" == "healthy" && "$REDIS_NOW" == "healthy" ]]; then
      success "PostgreSQL y Redis listos."
      break
    fi
    echo -n "."
    if [[ $i -eq 30 ]]; then
      error "Timeout esperando infraestructura. Revisá logs:"
      echo "  docker compose -f $COMPOSE_FILE logs postgres redis"
      exit 1
    fi
  done
else
  info "Paso 2 — Infraestructura OK, se omite"
fi

# ── 3. Migración ─────────────────────────────────────────────
if $NEED_MIGRATION; then
  header "  Paso 3 — Ejecutando migración de BD"

  # Si el contenedor anterior falló, eliminarlo primero
  if [[ "$MIG_STATUS" != "missing" ]]; then
    info "Eliminando contenedor de migración anterior (exit=$MIG_EXIT)..."
    docker rm -f gddocs_migration 2>/dev/null || true
  fi

  info "Corriendo migración..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up gddocs_migration

  # Esperar resultado
  sleep 3
  MIG_EXIT_NOW=$(container_exit_code "gddocs_migration")
  if [[ "$MIG_EXIT_NOW" == "0" ]]; then
    success "Migración completada correctamente."
  else
    error "La migración falló (exit $MIG_EXIT_NOW). Logs:"
    docker logs gddocs_migration 2>&1 | awk 'length($0) < 300' | tail -30
    echo ""
    error "Abortando. Arreglá la migración antes de levantar el servidor."
    exit 1
  fi
else
  info "Paso 3 — Migración OK, se omite"
fi

# ── 4. Servidor ──────────────────────────────────────────────
if $NEED_SERVER; then
  header "  Paso 4 — Reparando servidor GD docs"

  if [[ "$SRV_STATUS" == "restarting" || "$SRV_STATUS" == "running" ]]; then
    info "Deteniendo servidor actual..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop gddocs 2>/dev/null || true
    docker rm -f gddocs_server 2>/dev/null || true
  fi

  info "Levantando servidor..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d gddocs

  # Dar tiempo para que arranque o crashee
  sleep 8
  SRV_NOW=$(container_status "gddocs_server")
  SRV_RESTARTS_NOW=$(container_restarts "gddocs_server")

  if [[ "$SRV_NOW" == "running" && "$SRV_RESTARTS_NOW" == "0" ]]; then
    success "Servidor iniciado correctamente."
  elif [[ "$SRV_NOW" == "running" && "$SRV_RESTARTS_NOW" -gt 0 ]]; then
    warn "Servidor corriendo pero con $SRV_RESTARTS_NOW reinicios — puede estar inestable."
    warn "Revisá logs: docker compose -f $COMPOSE_FILE logs -f gddocs"
  elif [[ "$SRV_NOW" == "restarting" ]]; then
    error "El servidor sigue en crash loop. Últimas líneas del log:"
    docker logs gddocs_server 2>&1 | awk 'length($0) < 300' | tail -20
    echo ""
    error "El servidor no arranca. Puede que necesites un nuke completo:"
    echo "  bash $SCRIPT_DIR/nuke.sh"
    exit 1
  else
    warn "Estado inesperado: $SRV_NOW. Revisá manualmente."
  fi
else
  info "Paso 4 — Servidor OK, se omite"
fi

# ── Resultado final ──────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  GD docs reparado                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐  App:       http://localhost:${PORT:-3010}"
echo "  📋  Ver logs:  docker compose -f $COMPOSE_FILE logs -f"
echo "  🛑  Detener:   docker compose -f $COMPOSE_FILE down"
echo ""
