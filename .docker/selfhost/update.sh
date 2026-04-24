#!/usr/bin/env bash
# ============================================================
#  GD docs — Script de actualización
#  Reconstruye la imagen desde el código fuente y reinicia
#  los servicios con cero downtime.
#
#  Uso:
#    bash update.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
IMAGE_NAME="gddocs:latest"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

DATA_ROOT="$HOME/.gddocs"

[[ -f "$ENV_FILE" ]] || error "No se encontró .env. Ejecutá install.sh primero."

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              GD docs — Actualizador                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ---------- Reconstruir imagen desde fuente ----------
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Reconstruyendo imagen Docker desde código fuente...    ║"
echo "║  Esto tarda 5-15 minutos. Normal.                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Ejecutando: docker build -t ${IMAGE_NAME} ..."

docker build \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen reconstruida: ${IMAGE_NAME}"

# ---------- Reiniciar servicios ----------
echo ""
info "Reiniciando servicios con la nueva imagen..."
docker compose -f "$SCRIPT_DIR/compose.yml" --env-file "$ENV_FILE" up -d

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  GD docs actualizado                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  📋  Ver logs:   docker compose -f $SCRIPT_DIR/compose.yml logs -f"
echo "  🛑  Detener:    docker compose -f $SCRIPT_DIR/compose.yml down"
echo ""
