#!/usr/bin/env bash
# ============================================================
#  GD docs — Configuración de nginx + SSL automático
#  Instala nginx, obtiene certificado Let's Encrypt y deja
#  el sitio listo con HTTPS en un solo comando.
#
#  Requisitos:
#    - Ubuntu 20.04 / 22.04 / Debian 11+
#    - El dominio ya apunta a este servidor (DNS configurado)
#    - GD docs corriendo en puerto 3010 (bash install.sh primero)
#
#  Uso:
#    bash setup-nginx-ssl.sh
#    bash setup-nginx-ssl.sh --domain docs.tuempresa.com --email admin@tuempresa.com
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

APP_PORT=3010
DOMAIN=""
EMAIL=""

# ---------- Argumentos ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email)  EMAIL="$2";  shift 2 ;;
    --port)   APP_PORT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         GD docs — nginx + SSL (Let's Encrypt)           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ---------- Pedir datos si faltan ----------
if [[ -z "$DOMAIN" ]]; then
  read -rp "  Dominio (ej: docs.tuempresa.com): " DOMAIN
fi
[[ -z "$DOMAIN" ]] && error "El dominio es obligatorio."

if [[ -z "$EMAIL" ]]; then
  read -rp "  Email para Let's Encrypt (notificaciones): " EMAIL
fi
[[ -z "$EMAIL" ]] && error "El email es obligatorio."

echo ""
info "Dominio : $DOMAIN"
info "Email   : $EMAIL"
info "Puerto  : $APP_PORT"
echo ""

# ---------- Verificar root ----------
[[ "$EUID" -ne 0 ]] && error "Ejecutá este script con sudo: sudo bash setup-nginx-ssl.sh"

# ---------- Verificar que GD docs está corriendo ----------
if ! curl -sf "http://localhost:${APP_PORT}" >/dev/null 2>&1; then
  warn "GD docs no responde en localhost:${APP_PORT}."
  warn "Asegurate de haber ejecutado install.sh primero."
  read -rp "  ¿Continuar de todas formas? [s/N] " cont
  [[ "${cont,,}" != "s" ]] && error "Abortado."
fi

# ---------- Instalar nginx ----------
info "Instalando nginx..."
apt-get update -qq
apt-get install -y nginx
success "nginx instalado."

# ---------- Instalar certbot ----------
info "Instalando certbot..."
apt-get install -y certbot python3-certbot-nginx
success "certbot instalado."

# ---------- Crear configuración nginx (HTTP primero, certbot agrega HTTPS) ----------
SITE_CONF="/etc/nginx/sites-available/gddocs"

info "Creando configuración nginx para $DOMAIN ..."
cat > "$SITE_CONF" << NGINXCONF
# GD docs — configuración generada por setup-nginx-ssl.sh
# No editar manualmente si usás certbot (reemplaza las secciones SSL automáticamente)

# Redirect HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Necesario para que certbot pueda verificar el dominio
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS principal
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${DOMAIN};

    # --- Certificados SSL (certbot los completa automáticamente) ---
    # ssl_certificate y ssl_certificate_key se agregan por certbot

    # --- Seguridad TLS ---
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS (6 meses)
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains" always;

    # Headers de seguridad
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # --- Logs ---
    access_log /var/log/nginx/gddocs.access.log;
    error_log  /var/log/nginx/gddocs.error.log;

    # --- Proxy a GD docs ---
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;

        # WebSocket (co-edición en tiempo real)
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers de proxy estándar
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts generosos para uploads y docs grandes
        proxy_read_timeout    600s;
        proxy_connect_timeout 60s;
        proxy_send_timeout    600s;

        # Tamaño máximo de upload (ajustá según necesidad)
        client_max_body_size 100m;
    }
}
NGINXCONF

success "Configuración nginx creada: $SITE_CONF"

# ---------- Habilitar el sitio ----------
ln -sf "$SITE_CONF" /etc/nginx/sites-enabled/gddocs
# Deshabilitar default si existe
rm -f /etc/nginx/sites-enabled/default

# ---------- Verificar configuración nginx ----------
info "Verificando configuración nginx..."
nginx -t || error "La configuración nginx tiene errores. Revisá $SITE_CONF"
success "Configuración nginx válida."

# ---------- Iniciar / recargar nginx ----------
systemctl enable nginx
systemctl reload nginx || systemctl start nginx
success "nginx iniciado."

# ---------- Obtener certificado SSL ----------
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Obteniendo certificado SSL de Let's Encrypt...         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --domains "$DOMAIN" \
  --redirect

success "Certificado SSL instalado para $DOMAIN"

# ---------- Verificar renovación automática ----------
info "Verificando renovación automática..."
systemctl enable certbot.timer 2>/dev/null || \
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -
success "Renovación automática configurada (certbot.timer o cron)."

# ---------- Recarga final ----------
nginx -t && systemctl reload nginx

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  ¡Todo listo!                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐  Tu sitio:       https://${DOMAIN}"
echo "  🔒  SSL:            Let's Encrypt (renovación automática)"
echo "  📋  Logs nginx:     /var/log/nginx/gddocs.access.log"
echo "  🛠️   Config nginx:   /etc/nginx/sites-available/gddocs"
echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  Para renovar el cert manualmente:"
echo "    sudo certbot renew"
echo "  Para ver estado de nginx:"
echo "    sudo systemctl status nginx"
echo "  ─────────────────────────────────────────────────────────"
echo ""
