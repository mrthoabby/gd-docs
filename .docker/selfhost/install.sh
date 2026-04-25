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

# ── Tiempo de inicio ─────────────────────────────────────────
START_TS=$(date +%s)
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

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

# ── Trap: siempre muestra timing + diagnóstico al salir ──────
# Se activa en cualquier salida: error, set -e, Ctrl+C, o exit normal.
# Para salidas exitosas (exit 0) solo muestra timing si el banner
# de éxito ya no se imprimió (el script llegó al final normalmente
# y ya lo muestra — la condición [[ $exit_code -ne 0 ]] lo omite).
on_exit() {
  local exit_code=$?
  set +e  # No fallar dentro del handler de limpieza

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

  # Mostrar logs de contenedores con problemas
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
# Un build completo necesita al menos 5-8 GB libres.
check_disk_space() {
  local available_kb
  available_kb=$(df -k "$REPO_ROOT" 2>/dev/null | tail -1 | awk '{print $4}' || echo 0)
  local warn_kb=$((5 * 1024 * 1024))   # 5 GB
  local min_kb=$((2 * 1024 * 1024))    # 2 GB
  if [[ "$available_kb" -lt "$min_kb" ]]; then
    local gb; gb=$(awk "BEGIN{printf \"%.1f\", $available_kb/1048576}")
    error "Espacio insuficiente: ${gb}GB disponibles. Necesitás al menos 2GB libres."
  elif [[ "$available_kb" -lt "$warn_kb" ]]; then
    local gb; gb=$(awk "BEGIN{printf \"%.1f\", $available_kb/1048576}")
    warn "Espacio en disco bajo: ${gb}GB disponibles. Se recomiendan 5GB+ para el build."
  fi
}

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
echo "  ⏱️  Inicio: ${START_TIME}"
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
  info "Docker Compose no encontrado — instalando plugin desde GitHub..."

  # Detectar arquitectura del sistema
  case "$(uname -m)" in
    x86_64)          COMPOSE_ARCH="x86_64" ;;
    aarch64|arm64)   COMPOSE_ARCH="aarch64" ;;
    armv7l)          COMPOSE_ARCH="armv7" ;;
    *)               COMPOSE_ARCH="$(uname -m)" ;;
  esac

  # Obtener la última versión disponible (con fallback fijo si falla la API)
  COMPOSE_VERSION=$(curl -fsSL \
    https://api.github.com/repos/docker/compose/releases/latest \
    2>/dev/null | grep '"tag_name"' | cut -d'"' -f4) || true
  COMPOSE_VERSION="${COMPOSE_VERSION:-v2.27.0}"

  COMPOSE_PLUGIN_DIR="/usr/local/lib/docker/cli-plugins"
  mkdir -p "$COMPOSE_PLUGIN_DIR"

  curl -fsSL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
    -o "${COMPOSE_PLUGIN_DIR}/docker-compose" || \
    error "No se pudo descargar Docker Compose. Instalalo manualmente: https://docs.docker.com/compose/install/"

  chmod +x "${COMPOSE_PLUGIN_DIR}/docker-compose"
  success "Docker Compose ${COMPOSE_VERSION} instalado (${COMPOSE_ARCH})."
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

# ---------- Generar config JSON con credenciales sustituidas ----------
generate_config() {
  local config_dir="${1}"
  local minio_user="${2}"
  local minio_pass="${3}"
  local src="$SCRIPT_DIR/config.selfhost.json"
  local dst="${config_dir}/affine.config.json"

  mkdir -p "${config_dir}"

  if command -v envsubst &>/dev/null; then
    MINIO_ROOT_USER="${minio_user}" MINIO_ROOT_PASSWORD="${minio_pass}" \
      envsubst < "${src}" > "${dst}"
  else
    # Fallback: sed (siempre disponible en Linux)
    sed \
      -e "s|\${MINIO_ROOT_USER}|${minio_user}|g" \
      -e "s|\${MINIO_ROOT_PASSWORD}|${minio_pass}|g" \
      "${src}" > "${dst}"
  fi
}

# ---------- Crear .env ----------
if [[ -f "$ENV_FILE" ]]; then
  warn ".env ya existe — se conserva. Bórralo si quieres regenerarlo."
  # Cargar variables para generar el config aunque el .env ya exista
  set -a; source "$ENV_FILE"; set +a

  # Si el .env existente no tiene MINIO_ROOT_PASSWORD (instalación previa a MinIO),
  # generarla y agregarla automáticamente.
  if [[ -z "${MINIO_ROOT_PASSWORD:-}" ]]; then
    MINIO_ROOT_PASSWORD=$(generate_password)
    MINIO_ROOT_USER="${MINIO_ROOT_USER:-gddocs}"
    MINIO_DATA_LOCATION="${MINIO_DATA_LOCATION:-${DATA_ROOT}/minio}"
    cat >> "$ENV_FILE" << EOF

# MinIO — agregado automáticamente (migración desde versión sin MinIO)
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_DATA_LOCATION=${MINIO_DATA_LOCATION}
EOF
    export MINIO_ROOT_PASSWORD MINIO_ROOT_USER MINIO_DATA_LOCATION
    echo ""
    success "Credenciales MinIO generadas y guardadas en .env"
    echo "  🔑  MinIO usuario:     ${MINIO_ROOT_USER}"
    echo "  🔑  MinIO contraseña:  ${MINIO_ROOT_PASSWORD}"
    echo "  ⚠️   Guardá esta contraseña en un lugar seguro."
    echo ""
  fi
else
  info "Generando configuración..."
  DB_PASSWORD=$(generate_password)
  MINIO_ROOT_PASSWORD=$(generate_password)
  cat > "$ENV_FILE" << EOF
# GD docs — Configuración generada el $(date -u '+%Y-%m-%d %H:%M UTC')

PORT=${PORT}

# Rutas de datos (cambiá si querés otra ubicación)
DB_DATA_LOCATION=${DATA_ROOT}/postgres/pgdata
CONFIG_LOCATION=${DATA_ROOT}/config
ASSETS_LOCATION=${DATA_ROOT}/static

# Base de datos
DB_USERNAME=gddocs
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=gddocs

# MinIO — almacenamiento de objetos (blobs, avatares, copilot)
MINIO_ROOT_USER=gddocs
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_DATA_LOCATION=${DATA_ROOT}/minio

# Rendimiento
NODE_OPTIONS=--max-old-space-size=4096
EOF
  success ".env creado."
  echo ""
  echo "  ⚠️  Guardá estas contraseñas en un lugar seguro:"
  echo "       BD:     ${DB_PASSWORD}"
  echo "       MinIO:  ${MINIO_ROOT_PASSWORD}"
  echo ""

  # Cargar el .env recién creado
  set -a; source "$ENV_FILE"; set +a
fi

# ---------- Crear directorios ----------
info "Creando directorios de datos..."
mkdir -p "${DATA_ROOT}"/{postgres/pgdata,config,static/fonts,static/ppt-images/background,minio}
success "Directorios listos."

# ---------- Generar affine.config.json con credenciales MinIO ----------
info "Generando configuración con credenciales MinIO..."
generate_config \
  "${CONFIG_LOCATION:-${DATA_ROOT}/config}" \
  "${MINIO_ROOT_USER:-gddocs}" \
  "${MINIO_ROOT_PASSWORD}"
success "Archivo de configuración generado: ${CONFIG_LOCATION:-${DATA_ROOT}/config}/affine.config.json"

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
check_disk_space
info "Ejecutando: docker build -t ${IMAGE_NAME} ..."

DOCKER_BUILDKIT=1 docker build \
  -f "$SCRIPT_DIR/Dockerfile.selfhost" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

success "Imagen construida: ${IMAGE_NAME}"

# Eliminar imágenes dangling (las que quedan sin tag tras cada rebuild)
docker image prune -f 2>/dev/null || true

# ---------- Levantar servicios ----------
echo ""
info "Iniciando GD docs (esperando que todos los servicios sean saludables)..."
# --wait bloquea hasta que todos los healthchecks pasen y las
# migraciones terminen. Si algo falla, el comando devuelve error
# y el script se detiene con set -euo pipefail.
docker compose -f "$SCRIPT_DIR/compose.yml" --env-file "$ENV_FILE" up -d --wait

# ── Resumen final con tiempos ────────────────────────────────
END_TS=$(date +%s)
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
ELAPSED=$((END_TS - START_TS))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  GD docs está corriendo                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐  Abre en el browser:  http://localhost:${PORT}"
echo "  🪣  Consola MinIO:       http://localhost:9001"
echo "       Usuario: ${MINIO_ROOT_USER:-gddocs}"
echo ""
echo "  El primer usuario que se registre queda como administrador."
echo ""
echo "  ⏱️  Inicio:      ${START_TIME}"
echo "  ⏱️  Fin:         ${END_TIME}"
printf "  ⏱️  Duración:    %dm %ds\n" "$ELAPSED_MIN" "$ELAPSED_SEC"
echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  📋  Ver logs:      docker compose -f $SCRIPT_DIR/compose.yml logs -f"
echo "  🛑  Detener:       docker compose -f $SCRIPT_DIR/compose.yml down"
echo "  ♻️   Actualizar:    bash $SCRIPT_DIR/update.sh"
echo "  ─────────────────────────────────────────────────────────"
echo ""
