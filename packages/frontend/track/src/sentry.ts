// [SELFHOST PATCH] Sentry desactivado — GD docs no envía telemetría de errores a terceros.
// Los errores se loguean en la consola del browser y en los logs del servidor Docker.

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
