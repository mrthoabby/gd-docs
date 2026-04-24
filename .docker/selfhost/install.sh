#!/usr/bin/env bash
# ============================================================
#  GD docs — Instalador universal
#  Construye tu versión personalizada desde el código fuente
#  y levanta todos los servicios en un solo comando.
#
#  Uso:
#    bash install.sh
#    bash install.sh --port 3010
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
IMAGE_NAME="gddocs:latest"
DATA_ROOT="$HOME/.gddocs"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

PORT=3010

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    *) warn "Argumento desconocido: $1"; shift ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              GD docs — Instalador                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ---------- Verificar e instalar dependencias ----------
info "Verificando dependencias..."

install_docker() {
  info "Docker no encontrado — instalando automáticamente..."

  # Limpiar restos de intentos anteriores que puedan romper apt
  info "Limpiando configuración previa de Docker..."
  rm -f /etc/apt/sources.list.d/docker.list \
        /etc/apt/sources.list.d/docker-ce.list \
        /etc/apt/keyrings/docker.gpg \
        /etc/apt/keyrings/docker.asc 2>/dev/null || true

  if command -v apt-get &>/dev/null; then
    apt-get update -qq 2>/dev/null || true
    apt-get install -y --quiet curl 2>/dev/null || true
  fi

  if ! command -v curl &>/dev/null; then
    error "No se pudo instalar curl. Instalá Docker manualmente: https://docs.docker.com/get-docker/"
  fi

  info "Descargando instalador oficial de Docker..."
  curl -fsSL https://get.docker.com | sh || \
    error "Falló la instalación de Docker. Intentalo manualmente: https://docs.docker.com/get-docker/"

  systemctl enable docker
  systemctl start docker

  if [[ -n "${SUDO_USER:-}" ]]; then
    usermod -aG docker "$SUDO_USER"
    warn "Usuario '$SUDO_USER' agregado al grupo docker. Cerrá y volvé a abrir sesión para no necesitar sudo."
  fi

  success "Docker instalado correctamente."
}

if ! command -v docker &>/dev/null; then
  if [[ "$EUID" -ne 0 ]]; then
    error "Docker no está instalado. Ejecutá el instalador con sudo para que lo instale automáticamente:\n  sudo bash install.sh"
  fi
  install_docker
fi

if ! docker compose version &>/dev/null 2>&1 && ! docker-compose version &>/dev/null 2>&1; then
  if [[ "$EUID" -ne 0 ]]; then
    error "Docker Compose no está disponible. Ejecutá con sudo para instalarlo automáticamente."
  fi
  info "Docker Compose no encontrado — instalando plugin..."
  apt-get install -y docker-compose-plugin 2>/dev/null || \
    error "No se pudo instalar Docker Compose. Instalalo manualmente: https://docs.docker.com/compose/install/"
  success "Docker Compose instalado."
fi

success "Docker y Docker Compose encontrados."

# ---------- Generar contraseña ----------
generate_password() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 | tr -d '=+/' | head -c 32
  else
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1
  fi
}

# ---------- Crear .env ----------
if [[ -f "$ENV_FILE" ]]; then
  warn ".env ya existe — se conserva. Bórralo si quieres regenerarlo."
else
  info "Generando configuración..."
  DB_PASSWORD=$(generate_password)
  cat > "$ENV_FILE" << EOF
# GD docs — Configuración generada el $(date -u '+%Y-%m-%d %H:%M UTC')

PORT=${PORT}

# Rutas de datos (cambiá si querés otra ubicación)
DB_DATA_LOCATION=${DATA_ROOT}/postgres/pgdata
UPLOAD_LOCATION=${DATA_ROOT}/storage
CONFIG_LOCATION=${DATA_ROOT}/config
ASSETS_LOCATION=${DATA_ROOT}/static

# Base de datos
DB_USERNAME=gddocs
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=gddocs

# Rendimiento
NODE_OPTIONS=--max-old-space-size=4096
EOF
  success ".env creado."
  echo ""
  echo "  ⚠️  Guardá esta contraseña de BD: ${DB_PASSWORD}"
  echo ""
fi

# ---------- Crear directorios ----------
info "Creando directorios de datos..."
mkdir -p "${DATA_ROOT}"/{postgres/pgdata,storage,config,static/fonts,static/ppt-images/background}
success "Directorios listos."

# ---------- Descargar assets estáticos ----------
echo ""
info "Descargando fuentes e imágenes (una sola vez, para no depender de CDN externo)..."
if bash "$SCRIPT_DIR/download-assets.sh" "${DATA_ROOT}/static" 2>/dev/null; then
  success "Assets estáticos listos."
else
  warn "Algunos assets fallaron. El editor funciona igual pero puede cargar fuentes de internet."
  warn "Reintentá luego con: bash download-assets.sh"
fi

# ---------- Construir imagen Docker ----------
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Construyendo imagen Docker desde código fuente...      ║"
echo "║  Esto tarda 15-25 minutos la primera vez. Normal.       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Ejecutando: docker build -t ${IMAGE_NAME} ..."

docker build \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen construida: ${IMAGE_NAME}"

# Eliminar imágenes dangling (las que quedan sin tag tras cada rebuild)
docker image prune -f 2>/dev/null || true

# ---------- Levantar servicios ----------
echo ""
info "Iniciando GD docs..."
docker compose -f "$SCRIPT_DIR/compose.yml" --env-file "$ENV_FILE" up -d

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  GD docs está corriendo                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐  Abre en el browser:  http://localhost:${PORT}"
echo ""
echo "  El primer usuario que se registre queda como administrador."
echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  📋  Ver logs:      docker compose -f $SCRIPT_DIR/compose.yml logs -f"
echo "  🛑  Detener:       docker compose -f $SCRIPT_DIR/compose.yml down"
echo "  ♻️   Actualizar:    bash $SCRIPT_DIR/update.sh"
echo "  ─────────────────────────────────────────────────────────"
echo ""
