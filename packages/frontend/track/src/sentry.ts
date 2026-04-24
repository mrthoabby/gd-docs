// [SELFHOST PATCH] Sentry fue desactivado completamente para instalaciones self-hosted.
// Sentry enviaba errores de runtime al servicio externo sentry.io (telemetría de errores).
// En su lugar, los errores se loguean en la consola del navegador y en los logs del servidor.
//
// Si necesitás monitoreo de errores, podés usar tu propia instancia de Sentry:
//   1. Instalar Sentry self-hosted: https://develop.sentry.dev/self-hosted/
//   2. Configurar SENTRY_DSN en las variables de build apuntando a tu instancia
//   3. Restaurar el código original de este archivo

function createSentry() {
  const wrapped = {
    init() {
      // No-op: Sentry desactivado en self-hosted
      if (BUILD_CONFIG.debug) {
        console.debug('[GD docs] Sentry desactivado (modo self-hosted)');
      }
    },
    enable() {
      // No-op
    },
    disable() {
      // No-op
    },
  };
  return wrapped;
}

export const sentry = createSentry();
