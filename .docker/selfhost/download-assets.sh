#!/usr/bin/env bash
# ============================================================
#  GD docs — Descarga de assets estáticos (fuentes + imágenes)
#
#  Descarga una sola vez todos los archivos que el editor necesita
#  para funcionar sin depender de cdn.affine.pro en runtime.
#  Se monta como volumen en Docker: los archivos quedan en tu servidor.
#
#  Uso:
#    bash download-assets.sh              # descarga en ruta por defecto
#    bash download-assets.sh /ruta/propia # descarga en ruta personalizada
# ============================================================
set -euo pipefail

ASSETS_DIR="${1:-${HOME}/.gddocs/static}"
CDN="https://cdn.affine.pro"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[SKIP]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; }

# ---------- Fuentes del editor (canvas Edgeless, PDF, Typst) ----------
FONTS=(
  # Inter — fuente principal del editor
  "Inter-Regular.woff2"
  "Inter-SemiBold.woff2"
  "Inter-Italic.woff2"
  "Inter-SemiBoldItalic.woff2"
  "Inter-Light-BETA.woff2"
  "Inter-LightItalic-BETA.woff2"
  # Versiones .woff (para PDF y Typst renderer)
  "Inter-Regular.woff"
  "Inter-SemiBold.woff"
  "Inter-Italic.woff"
  "Inter-SemiBoldItalic.woff"
  # Sarasa Gothic — soporte CJK (chino/japonés/coreano)
  "SarasaGothicCL-Regular.ttf"
  # Fuentes alternativas para el canvas Edgeless
  "Kalam-Light.woff2"
  "Kalam-Regular.woff2"
  "Kalam-Bold.woff2"
  "Satoshi-Light.woff2"
  "Satoshi-Regular.woff2"
  "Satoshi-Bold.woff2"
  "Satoshi-LightItalic.woff2"
  "Satoshi-Italic.woff2"
  "Satoshi-BoldItalic.woff2"
  "Poppins-Light.woff2"
  "Poppins-Regular.woff2"
  "Poppins-Medium.woff2"
  "Poppins-SemiBold.woff2"
  "Poppins-LightItalic.woff2"
  "Poppins-Italic.woff2"
  "Poppins-SemiBoldItalic.woff2"
  "Lora-Regular.woff2"
  "Lora-Bold.woff2"
  "Lora-Italic.woff2"
  "Lora-BoldItalic.woff2"
  "BebasNeue-Light.woff2"
  "BebasNeue-Regular.woff2"
  "OrelegaOne-Regular.woff2"
)

# ---------- Imágenes de fondo para presentaciones AI ----------
PPT_IMAGES=(
  "ppt-images/background/basic_2_selection_background.png"
  "ppt-images/background/basic_3_selection_background.png"
  "ppt-images/background/basic_4_selection_background.png"
)

# ---------- Función de descarga con retry ----------
download_file() {
  local url="$1"
  local dest="$2"

  if [[ -f "$dest" ]]; then
    warn "Ya existe: $(basename "$dest") — omitiendo"
    return 0
  fi

  local dir
  dir="$(dirname "$dest")"
  mkdir -p "$dir"

  if curl -fsSL --retry 3 --retry-delay 2 -o "$dest" "$url" 2>/dev/null; then
    success "$(basename "$dest")"
  else
    fail "No se pudo descargar: $url"
    rm -f "$dest"
    return 1
  fi
}

# ---------- Main ----------
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║      GD docs — Descarga de assets estáticos             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Destino: $ASSETS_DIR"
echo ""

FAILED=0

# Fuentes
info "Descargando fuentes del editor (${#FONTS[@]} archivos)..."
for font in "${FONTS[@]}"; do
  download_file "${CDN}/fonts/${font}" "${ASSETS_DIR}/fonts/${font}" || ((FAILED++))
done

echo ""

# Imágenes PPT
info "Descargando imágenes de presentaciones AI (${#PPT_IMAGES[@]} archivos)..."
for img in "${PPT_IMAGES[@]}"; do
  download_file "${CDN}/${img}" "${ASSETS_DIR}/${img}" || ((FAILED++))
done

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║      ✅  Assets descargados correctamente                ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "  📁  Fuentes en:    ${ASSETS_DIR}/fonts/"
  echo "  📁  Imágenes en:   ${ASSETS_DIR}/ppt-images/"
  echo ""
  echo "  Asegurate de que compose.yml tenga los volúmenes:"
  echo "    - \${ASSETS_LOCATION}/fonts:/app/static/fonts:ro"
  echo "    - \${ASSETS_LOCATION}/ppt-images:/app/static/ppt-images:ro"
  echo ""
else
  warn "Completado con ${FAILED} error(es). Revisá tu conexión y volvé a ejecutar."
fi
