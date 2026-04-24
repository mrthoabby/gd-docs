#!/usr/bin/env bash
# ============================================================
#  GD docs — NUKE: borrado total y reinstalación desde cero
#
#  ⚠️  DESTRUYE todos los datos (BD, uploads, config).
#      Usa solo cuando quieres empezar completamente de nuevo.
#
#  Qué hace:
#    1. Para y elimina TODOS los contenedores de gddocs
#    2. Borra TODOS los volúmenes de gddocs (incluida la BD)
#    3. Borra la imagen Docker gddocs:latest
#    4. git pull para bajar los últimos cambios
#    5. Reconstruye la imagen desde cero (--no-cache)
#    6. Levanta todos los servicios frescos
#
#  Uso:
#    bash nuke.sh              # pide confirmación
#    bash nuke.sh --yes        # sin preguntar (para CI/scripts)
#    bash nuke.sh --skip-pull  # no hace git pull
#    bash nuke.sh --port 8080  # usa otro puerto
# ============================================================
set -euo pipefail

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

# ---------- Argumentos ----------
AUTO_YES=false
SKIP_PULL=false
PORT=3010
GIT_REMOTE_URL=""   # Si lo dejas vacío usa el remote actual del repo

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)       AUTO_YES=true; shift ;;
    --skip-pull)    SKIP_PULL=true;  shift ;;
    --port)         PORT="$2"; shift 2 ;;
    --remote)       GIT_REMOTE_URL="$2"; shift 2 ;;
    *) warn "Argumento desconocido: $1"; shift ;;
  esac
done

echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          ⚠️   GD docs — NUKE / REINSTALACIÓN TOTAL       ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Esto va a:${NC}"
echo "    • Parar y eliminar todos los contenedores de gddocs"
echo "    • BORRAR todos los datos de la base de datos"
echo "    • BORRAR uploads y configuración local ($DATA_ROOT)"
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

# Eliminar contenedores sueltos con nombre gddocs_ (si quedaron de pruebas manuales)
for cname in gddocs_server gddocs_migration gddocs_postgres gddocs_redis; do
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

# Limpiar imágenes dangling que pudieran quedar
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

# Borrar también el .env para que se regenere con contraseña nueva
if [[ -f "$ENV_FILE" ]]; then
  rm -f "$ENV_FILE"
  info ".env eliminado — se generará uno nuevo con contraseña nueva."
fi

success "Sistema limpio. Todo borrado."

# ── FASE 4: git pull ─────────────────────────────────────────
if [[ "$SKIP_PULL" == false ]]; then
  banner ""
  banner "  FASE 4 — Bajando últimos cambios del repositorio..."
  banner ""
  cd "$REPO_ROOT"

  if git rev-parse --git-dir &>/dev/null; then
    # Si se pasó --remote, actualizar el origin antes de jalar
    if [[ -n "$GIT_REMOTE_URL" ]]; then
      git remote set-url origin "$GIT_REMOTE_URL"
      info "Remote actualizado a: $GIT_REMOTE_URL"
    fi

    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "(sin remote configurado)")
    info "Jalando desde: ${CURRENT_REMOTE}"
    echo ""

    git pull || warn "git pull falló — continuando con el código actual."
    success "Código actualizado."

    echo ""
    echo "  Último commit:"
    git log -1 --oneline --color=always
    echo ""
  else
    warn "No es un repositorio git — se omite el pull."
    warn "Clonalo primero con:"
    warn "  git clone https://github.com/mrthoabby/gd-docs.git ."
  fi
fi

# ── FASE 5: Regenerar .env ───────────────────────────────────
banner ""
banner "  FASE 5 — Generando configuración nueva..."
banner ""

generate_password() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 | tr -d '=+/' | head -c 32
  else
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1
  fi
}

DB_PASSWORD=$(generate_password)
mkdir -p "${DATA_ROOT}"/{postgres/pgdata,storage,config,static/fonts,static/ppt-images/background}

cat > "$ENV_FILE" << EOF
# GD docs — Configuración generada el $(date -u '+%Y-%m-%d %H:%M UTC')
# (generada por nuke.sh — reinstalación completa)

PORT=${PORT}

DB_DATA_LOCATION=${DATA_ROOT}/postgres/pgdata
UPLOAD_LOCATION=${DATA_ROOT}/storage
CONFIG_LOCATION=${DATA_ROOT}/config
ASSETS_LOCATION=${DATA_ROOT}/static

DB_USERNAME=gddocs
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=gddocs

NODE_OPTIONS=--max-old-space-size=4096
EOF

success ".env generado."
echo ""
echo -e "  ${YELLOW}⚠️  Nueva contraseña de BD: ${BOLD}${DB_PASSWORD}${NC}"
echo "  (Guardala si la necesitas para acceso directo a PostgreSQL)"
echo ""

# ── FASE 6: Construir imagen desde cero ──────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FASE 6 — Construyendo imagen desde CERO (sin cache)    ║${NC}"
echo -e "${CYAN}║  Esto tarda 15-25 minutos. Normal. No cerres la terminal.║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

docker build \
  --no-cache \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen construida: ${IMAGE_NAME}"
docker image prune -f 2>/dev/null || true

# ── FASE 7: Descargar assets estáticos ───────────────────────
echo ""
info "Descargando fuentes e imágenes estáticas..."
if [[ -f "$SCRIPT_DIR/download-assets.sh" ]]; then
  if bash "$SCRIPT_DIR/download-assets.sh" "${DATA_ROOT}/static" 2>/dev/null; then
    success "Assets estáticos listos."
  else
    warn "Algunos assets fallaron. El editor funciona igual pero puede cargar fuentes de internet."
  fi
fi

# ── FASE 8: Levantar servicios ───────────────────────────────
echo ""
info "Levantando todos los servicios..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Esperar migraciones
echo ""
info "Esperando que las migraciones completen..."
for i in $(seq 1 30); do
  sleep 3
  STATUS=$(docker inspect gddocs_migration --format='{{.State.Status}}' 2>/dev/null || echo "")
  EXIT_CODE=$(docker inspect gddocs_migration --format='{{.State.ExitCode}}' 2>/dev/null || echo "")

  if [[ "$STATUS" == "exited" && "$EXIT_CODE" == "0" ]]; then
    success "Migraciones completadas."
    break
  elif [[ "$STATUS" == "exited" && "$EXIT_CODE" != "0" ]]; then
    echo ""
    warn "Migración terminó con error (exit $EXIT_CODE). Logs:"
    docker logs gddocs_migration 2>&1 | awk 'length($0) < 300' | tail -20
    break
  fi

  echo -n "."
  if [[ $i -eq 30 ]]; then
    warn "Tiempo de espera agotado. Revisá: docker logs gddocs_migration"
  fi
done

# ── RESULTADO ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        ✅  GD docs reinstalado desde cero                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  🌐  Abrí en el browser:  http://localhost:${PORT}"
echo ""
echo "  El primer usuario que se registre queda como administrador."
echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  📋  Ver logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "  🛑  Detener:     docker compose -f $COMPOSE_FILE down"
echo "  ♻️   Actualizar:  bash $SCRIPT_DIR/update.sh"
echo "  ─────────────────────────────────────────────────────────"
echo ""
