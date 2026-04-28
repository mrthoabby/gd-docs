# AFFiNE Self-Hosted — Guía de instalación y personalización

Este documento explica todos los ajustes realizados al proyecto y cómo operar tu instancia propia de AFFiNE con total control.

---

## Instalación rápida (un solo comando)

```bash
# Clonar o entrar a la carpeta selfhost
cd .docker/selfhost

# Ejecutar el instalador automático
bash install.sh

# Con dominio propio:
bash install.sh --host affine.tudominio.com --port 3010

# Actualizar a una nueva versión:
bash update.sh
# o cambiar a canal beta:
bash update.sh --revision beta
```

El script automáticamente:
- Genera una contraseña segura para la base de datos
- Crea el archivo `.env`
- Descarga las imágenes Docker
- Levanta todos los servicios

---

## Estructura de archivos

```
.docker/selfhost/
├── install.sh              ← Instalador automático (NUEVO)
├── update.sh               ← Script de actualización (NUEVO)
├── compose.yml             ← Docker Compose (PostgreSQL + Redis + AFFiNE)
├── .env                    ← Variables de entorno (se crea al instalar)
├── config.selfhost.json    ← Config recomendada para self-hosted (NUEVO)
├── config.s3.json          ← Config con almacenamiento S3 (NUEVO)
└── SELFHOST-GUIDE.md       ← Este archivo
```

La config que uses debe copiarse como `affine.json` en tu `CONFIG_LOCATION` (por defecto `~/.affine/self-host/config/affine.json`).

---

## Configuración de persistencia

### Opción 1: Almacenamiento local (por defecto)
Los archivos se guardan en el disco del servidor. Definido en `config.selfhost.json`:

```json
"storages": {
  "blob.storage": {
    "provider": "fs",
    "bucket": "blobs",
    "config": { "path": "~/.affine/storage" }
  }
}
```

### Opción 2: Amazon S3 o compatible (MinIO, Cloudflare R2, etc.)
Copiar `config.s3.json` como tu `affine.json` y completar las credenciales:

```json
"storages": {
  "blob.storage": {
    "provider": "s3",
    "bucket": "mi-bucket-affine",
    "config": {
      "region": "us-east-1",
      "endpoint": "https://s3.amazonaws.com",
      "accessKeyId": "TU_ACCESS_KEY",
      "secretAccessKey": "TU_SECRET_KEY"
    }
  }
}
```

Para MinIO o Cloudflare R2, cambia `endpoint` al URL de tu servicio.

---

## Cuentas de usuario y autenticación

En self-hosted, **los usuarios crean cuentas en TU servidor** — no en los servidores de AFFiNE. Los datos nunca salen de tu infraestructura.

### Configuración recomendada (ya en `config.selfhost.json`):

```json
"auth": {
  "allowSignup": true,              // permitir registro de nuevos usuarios
  "requireEmailVerification": false, // sin verificación de email (se puede activar)
  "passwordRequirements": {
    "min": 8,
    "max": 128                       // contraseñas más largas permitidas
  }
}
```

Para **restringir el registro** (solo invitados por admin):
```json
"auth": {
  "allowSignup": false
}
```

### OAuth propio (GitHub, Google, OIDC)

Para que los usuarios puedan hacer login con GitHub o Google, configura en tu `.env`:

```env
# GitHub OAuth
AFFINE_GITHUB_CLIENT_ID=tu_client_id
AFFINE_GITHUB_CLIENT_SECRET=tu_client_secret

# Google OAuth
AFFINE_GOOGLE_CLIENT_ID=tu_client_id
AFFINE_GOOGLE_CLIENT_SECRET=tu_client_secret
```

O bien en `affine.json`:
```json
"oauth": {
  "providers.github": {
    "clientId": "tu_client_id",
    "clientSecret": "tu_client_secret"
  },
  "providers.google": {
    "clientId": "tu_client_id",
    "clientSecret": "tu_client_secret"
  }
}
```

---

## Modificaciones realizadas al código fuente

Los siguientes cambios fueron aplicados directamente al código. Se necesita **rebuild** de la imagen Docker para que tomen efecto. Si usás la imagen oficial de Docker Hub, estos cambios no se reflejan — necesitás construir la imagen desde el source.

### 1. Features habilitadas en Docker propio
**Archivo:** `packages/frontend/core/src/modules/cloud/constant.ts`

La imagen Docker propia expone solo features de servidor:
- `Copilot` — AI integrada (requiere configurar API key)
- `Indexer` — búsqueda avanzada
- `OAuth` — login con proveedores externos
- Límite de contraseña extendido a 128 caracteres

### 2. Banners de sincronizacion externa removidos
**Archivo:** `packages/frontend/core/src/components/top-tip.tsx`
**Archivo:** `packages/frontend/component/src/components/affine-banner/local-demo-tips.tsx`

Se elimino el banner que empujaba sincronizacion externa. En este build no aplica: la sincronizacion va a tu propio servidor.

### 3. Footer publicitario en páginas compartidas removido
**Archivo:** `packages/frontend/core/src/desktop/pages/workspace/share/share-footer.tsx`

Se eliminó el footer que enlazaba a affine.pro en páginas compartidas públicamente.

### 4. Feature flags experimentales desbloqueados
**Archivo:** `packages/frontend/core/src/modules/feature-flag/constant.ts`

Las siguientes funciones experimentales que antes solo estaban disponibles en "canary" ahora son accesibles en self-hosted:
- Editor de temas (Theme Editor)
- AI Playground (cambio de modelos)
- Block Meta
- Turbo Renderer
- Scribbled Style para Edgeless
- RTL (Right-to-Left) en el editor
- Adapter Panel
- Table Virtual Scroll
- Setting Subpage Animation
- Two Step Journal Confirmation

---

## Rebuild de la imagen Docker (necesario para cambios de código)

Si querés aplicar los cambios de código fuente a tu instancia:

```bash
# Desde la raíz del proyecto
docker build -f .github/deployment/node/Dockerfile \
  -t mi-affine-selfhost:latest .

# Luego editar compose.yml para usar tu imagen local:
# image: mi-affine-selfhost:latest  (en lugar de ghcr.io/toeverything/affine:...)
```

---

## Mantener actualizado

```bash
# Actualizar a la última versión stable:
bash update.sh

# Cambiar a canal beta:
bash update.sh --revision beta

# Cambiar a canary (últimas features, menos estable):
bash update.sh --revision canary
```

---

## Solución de problemas

**El servidor no inicia:**
```bash
docker compose -f .docker/selfhost/compose.yml logs affine
```

**La base de datos no conecta:**
```bash
docker compose -f .docker/selfhost/compose.yml logs postgres
```

**Reiniciar solo el servidor (sin perder datos):**
```bash
docker compose -f .docker/selfhost/compose.yml restart affine
```

**Verificar que todo esté corriendo:**
```bash
docker compose -f .docker/selfhost/compose.yml ps
```

---

## Cambios adicionales aplicados (sesión 2)

### Rebrand completo a "GD docs"
- **123 strings de UI** en `en.json` renombradas de "AFFiNE" a "GD docs"
- **Título del browser** → "GD docs"
- **manifest.json** → nombre de app actualizado
- **appNames** en `channel.ts` → todos los canales renombrados
- **Emails** del servidor → sin referencias a affine.pro
- **Server name** en configs → "GD docs Server"

### Servicios externos eliminados
| Servicio | Estado |
|---|---|
| Sentry (errores a sentry.io) | ✅ Desactivado (stub sin-op) |
| Check de actualizaciones (affine.pro) | ✅ Desactivado |
| Servidor de licencias (app.affine.pro) | ✅ Eliminado |
| Telemetría de analytics | ✅ Redirigida a servidor local (ya hecho en sesión 1) |
| affine.pro en redirect allowlist | ✅ Eliminado |
| Links a affine.pro en emails | ✅ Reemplazados por URLs relativas |

### Co-edición colaborativa confirmada 100% local
La co-edición **YA funciona completamente con tu PostgreSQL propio** en modo self-hosted:
- Protocolo: **YJS CRDT** sobre **Socket.IO WebSocket**
- Persistencia: **PostgreSQL** (tablas `Snapshot` y `Update`)
- Cero dependencias externas para la sincronización
- Los cursores y presencia de usuarios son en tiempo real (en memoria)

Para usar co-edición:
1. Los usuarios deben crear cuenta en **tu** servidor (no en AFFiNE cloud)
2. Crear un workspace (tipo "cloud" en la UI, que apunta a tu servidor)
3. Compartir el workspace con otros usuarios — la co-edición es automática

### Panel Root Admin en /admin/root
Accedé al panel con TODAS las configuraciones en:
```
http://tu-servidor:3010/admin/root
```

**Funcionalidades:**
- 📊 Dashboard con estadísticas del servidor
- 👥 Gestión de usuarios (listar, buscar, gestionar features)
- 🏷️ Asignar features especiales (administrator, early_access, copilot, etc.)
- 📁 Listado de workspaces
- 🚩 Toggle de feature flags experimentales
- ⚙️ Generador de configuración (auth, OAuth, storage FS/S3)
- ❤️ Verificación de salud del sistema
- 📜 Tabla de servicios externos bloqueados

> **Nota:** El panel de root requiere rebuild para tomar efecto (el HTML se sirve desde el backend). Alternativamente, podés servirlo como archivo estático externo con un proxy nginx apuntando a `/admin/root`.

---

## Cambios adicionales aplicados (sesión 3)

### 1. LoRA de Copilot — URLs configurables
**Archivo:** `packages/backend/server/src/plugins/copilot/prompt/prompts.ts`

Los modelos LoRA (sketch, clay, pixel) son opcionales:

```env
AFFINE_COPILOT_LORA_BASE_URL=https://models.tudominio.com
# Sin configurar: LoRA desactivado (sin crashes)
```

### 2. Emails de soporte internos
Todos los emails de `support@toeverything.info` fueron actualizados. Los links de soporte fueron eliminados completamente de la UI (sesión 4).

### 3. cdn.affine.pro — fuentes e imágenes configurables
```javascript
window.__GD_DOCS_FONT_BASE_URL__ = 'https://tu-servidor.com';
window.__GD_DOCS_ASSET_BASE_URL__ = 'https://tu-servidor.com';
```
Sin configurar, las fuentes cargan desde `cdn.affine.pro` (solo estáticos, sin datos de usuario).

### 4. Emails sin imágenes externas
Logo y footer de emails reemplazados por texto — sin tracking pixels de `cdn.affine.pro`.

---

## Cambios adicionales aplicados (sesión 4)

### 1. Autenticación de `/admin/root` — sesión real de usuario admin

Reemplazado el HTTP Basic Auth por la autenticación real de sesión de NestJS:

```
Flujo: Login en /admin → cookies de sesión → /admin/root (solo si eres admin)
```

- Usa las mismas cookies que el resto de la app (`affine_session`, `affine_user_id`)
- Verifica `administrator` feature via `FeatureService.isAdmin()`
- Sin `ADMIN_ROOT_SECRET`, sin secrets adicionales
- Si no estás autenticado → redirige a `/admin`
- Si no eres admin → respuesta 403

### 3. Feature flags — persistidos en BD del servidor

Los toggles de feature flags ya no usan `localStorage`. Usan la BD del servidor via:

- `GET /api/setup/admin-flags` → lee flags actuales
- `POST /api/setup/admin-flags` → guarda override en BD

Los cambios sobreviven reinicios y aplican a todos los usuarios del servidor.

### 4. Primer usuario = administrador automático

El flujo de setup (`/api/setup/create-admin-user`) ya garantiza esto. Al abrir el servidor por primera vez, muestra la pantalla de setup donde el primer usuario registrado recibe el rol `administrator` automáticamente.

### 5. Panel `/admin/root` — extensión del panel admin

El root admin ya no tiene autenticación separada. Es parte del flujo del panel admin:
- Accedé como admin en `/admin`
- Navegá a `/admin/root` (solo visible/accesible si tenés rol admin)

### 6. Limpieza total de referencias externas en UI

Eliminados de la interfaz de usuario (no reemplazados, directamente removidos):
- Todos los links a `affine.pro`, `ai.affine.pro`, `docs.affine.pro`
- Todos los links de email de soporte (`mailto:...`)
- Link a blog de release notes en sidebar
- Links de descarga de la app de escritorio
- Links de términos/privacidad de AFFiNE en About y mobile settings
- Links de comunidad/Discord de AFFiNE
- La función `maybeAffineOrigin()` ya no reconoce `affine.pro` como origen válido

### 7. Archivo de config renombrado: `affine.json` → `gd-docs.json`

El panel root ahora genera y descarga la config como `gd-docs.json`.
Ruta recomendada: `~/.affine/self-host/config/gd-docs.json`
