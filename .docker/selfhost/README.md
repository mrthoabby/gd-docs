# GD docs — Guía de instalación y operación

Todo lo que necesitás para instalar, actualizar y administrar tu instancia self-hosted de GD docs.

---

## Requisitos previos

- Linux (Ubuntu 20.04+ recomendado) o macOS
- Git
- Docker + Docker Compose (el instalador los instala automáticamente si no los tenés)
- 4 GB de RAM mínimo, 8 GB recomendado
- 20 GB de disco libre

---

## Primer uso — Instalación

Clona el repositorio en el servidor y ejecuta el instalador:

```bash
git clone https://github.com/mrthoabby/gd-docs.git
cd gd-docs
bash .docker/selfhost/install.sh
```

Opciones disponibles:

```bash
bash .docker/selfhost/install.sh --port 8080   # usar otro puerto (default: 3010)
```

El instalador hace todo automáticamente:
- Instala Docker si no está instalado (requiere sudo)
- Genera contraseñas seguras y crea el archivo `.env`
- Descarga fuentes e imágenes estáticas (sin dependencias de CDN en runtime)
- Construye la imagen Docker desde el código fuente (~15-25 min la primera vez)
- Levanta todos los servicios (app, base de datos, redis)

Al terminar, abre `http://localhost:3010` en el browser. El **primer usuario que se registre queda como administrador**.

---

## Actualización — Bajar cambios del repositorio

Cuando hagas cambios en el código y los subas a GitHub, en el servidor ejecuta:

```bash
bash .docker/selfhost/update.sh
```

Opciones:

```bash
bash .docker/selfhost/update.sh --skip-backup    # no hace backup de BD antes de actualizar
bash .docker/selfhost/update.sh --skip-pull      # no hace git pull (usás el código local)
bash .docker/selfhost/update.sh --remote https://github.com/mrthoabby/gd-docs.git  # forzar remote
```

El updater hace:
1. `git pull` desde el remote configurado (muestra qué URL usa)
2. Backup automático de la base de datos (guarda en `~/.gddocs/backups/`)
3. Reconstruye la imagen Docker (usa cache de capas, ~5-10 min)
4. Corre las migraciones de BD automáticamente
5. Reinicia todos los servicios

---

## NUKE — Borrado total y reinstalación desde cero

⚠️ **Destruye todos los datos.** Úsalo solo cuando querés empezar completamente de cero.

```bash
bash .docker/selfhost/nuke.sh
```

Opciones:

```bash
bash .docker/selfhost/nuke.sh --yes              # sin confirmación interactiva
bash .docker/selfhost/nuke.sh --skip-pull        # no hace git pull
bash .docker/selfhost/nuke.sh --port 8080        # usar otro puerto
bash .docker/selfhost/nuke.sh --remote https://github.com/mrthoabby/gd-docs.git  # forzar remote
```

Lo que hace:
1. Para y elimina **todos** los contenedores de gddocs
2. Borra **todos** los volúmenes de Docker (incluyendo la base de datos)
3. Borra los datos locales en `~/.gddocs` (uploads, config, pgdata)
4. Borra la imagen Docker `gddocs:latest`
5. `git pull` para bajar los últimos cambios
6. Reconstruye la imagen **sin cache** (`--no-cache`, ~15-25 min)
7. Levanta todos los servicios frescos

---

## Flujo de trabajo típico (desarrollo en otra máquina)

```
Máquina de desarrollo:
  git add . && git commit -m "mi cambio" && git push

Servidor:
  bash .docker/selfhost/update.sh       # para cambios normales
  # o
  bash .docker/selfhost/nuke.sh         # para empezar desde cero
```

Para verificar desde qué repositorio se jala el código:

```bash
cd ~/gd-docs
git remote -v
```

Para corregir el remote si apunta al lugar incorrecto:

```bash
git remote set-url origin https://github.com/mrthoabby/gd-docs.git
```

---

## Comandos de gestión diaria

```bash
# Ver logs en tiempo real
docker compose -f .docker/selfhost/compose.yml logs -f

# Ver logs solo del servidor principal
docker compose -f .docker/selfhost/compose.yml logs -f gddocs

# Ver logs de la migración (útil para diagnosticar errores de BD)
docker logs gddocs_migration

# Detener todos los servicios
docker compose -f .docker/selfhost/compose.yml down

# Reiniciar solo el servidor (sin tocar BD ni redis)
docker compose -f .docker/selfhost/compose.yml restart gddocs

# Ver estado de los servicios
docker compose -f .docker/selfhost/compose.yml ps
```

---

## Estructura de datos

Todos los datos persisten en `~/.gddocs/`:

```
~/.gddocs/
├── postgres/pgdata/   ← base de datos PostgreSQL
├── storage/           ← archivos subidos por los usuarios
├── config/            ← clave privada y configuración
├── static/
│   ├── fonts/         ← fuentes del editor (sin CDN)
│   └── ppt-images/    ← imágenes de fondo para presentaciones AI
└── backups/           ← backups automáticos de BD (update.sh)
```

---

## Backup y restauración manual

Backup manual de la BD:

```bash
docker exec gddocs_postgres pg_dump -U gddocs gddocs | gzip > backup_$(date +%Y%m%d).sql.gz
```

Restaurar un backup:

```bash
gunzip < backup_20250101.sql.gz | docker exec -i gddocs_postgres psql -U gddocs gddocs
```

---

## Archivos de configuración

| Archivo | Descripción |
|---|---|
| `.docker/selfhost/.env` | Variables de entorno (puertos, contraseñas, rutas) |
| `.docker/selfhost/compose.yml` | Definición de los servicios Docker |
| `.docker/selfhost/Dockerfile.selfhost` | Imagen Docker personalizada (sin Rust, sin Sentry) |
| `.docker/selfhost/install.sh` | Instalación inicial |
| `.docker/selfhost/update.sh` | Actualización con git pull |
| `.docker/selfhost/nuke.sh` | Borrado total y reinstalación |

---

## Solución de problemas

**La migración falla al iniciar**
```bash
docker logs gddocs_migration 2>&1 | awk 'length($0) < 300' | tail -30
```

**El servidor no responde**
```bash
docker compose -f .docker/selfhost/compose.yml logs gddocs | tail -50
```

**Reconstruir la imagen forzando sin cache**
```bash
docker build --no-cache -f .docker/selfhost/Dockerfile.selfhost -t gddocs:latest .
```

**Docker usó cache vieja y no tomó mis cambios**

Usa el nuke o reconstruye con `--no-cache`:
```bash
bash .docker/selfhost/nuke.sh --skip-pull --yes
```
