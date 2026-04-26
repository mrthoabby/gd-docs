import { Entity, LiveData } from '@toeverything/infra';
import { BehaviorSubject, combineLatest, map, NEVER } from 'rxjs';

import type { GlobalStateService } from '../../storage';
import { AFFINE_FLAGS } from '../constant';
import type { FlagInfo } from '../types';

const FLAG_PREFIX = 'affine-flag:';

export type Flag<F extends FlagInfo = FlagInfo> = {
  readonly value: F['defaultState'] extends boolean
    ? boolean
    : boolean | undefined;
  set: (value: boolean) => void;
  // eslint-disable-next-line rxjs/finnish
  $: F['defaultState'] extends boolean
    ? LiveData<boolean>
    : LiveData<boolean> | LiveData<boolean | undefined>;
} & F;

export class Flags extends Entity {
  private readonly globalState = this.globalStateService.globalState;

  // [SELFHOST PATCH] Overrides del servidor cargados desde /api/setup/feature-flags.
  // Permiten que el admin establezca valores por defecto para todos los usuarios.
  // Prioridad: localStorage (usuario) → override servidor → defaultState compilado.
  private readonly serverOverrides$ = new BehaviorSubject<
    Record<string, boolean>
  >({});

  constructor(private readonly globalStateService: GlobalStateService) {
    super();

    // Iniciar carga de overrides del servidor (sin bloquear la inicialización)
    if (environment.isSelfHosted) {
      this._loadServerFlags().catch(() => {
        // Silencioso — si falla, se usan defaults normales
      });
    }

    Object.entries(AFFINE_FLAGS).forEach(([flagKey, flag]) => {
      const configurable = flag.configurable ?? true;
      const defaultState =
        'defaultState' in flag ? flag.defaultState : undefined;

      const getValue = (): boolean | undefined => {
        // 1. Preferencia del usuario en localStorage
        const localValue = configurable
          ? this.globalState.get<boolean>(FLAG_PREFIX + flagKey)
          : undefined;
        if (localValue !== undefined) return localValue;

        // 2. Override del servidor (admin panel → BD)
        const serverValue = this.serverOverrides$.getValue()[flagKey];
        if (serverValue !== undefined) return serverValue;

        // 3. Default compilado
        return defaultState;
      };

      const item = {
        ...flag,
        get value() {
          return getValue();
        },
        set: (value: boolean) => {
          if (!configurable) {
            return;
          }
          this.globalState.set(FLAG_PREFIX + flagKey, value);
        },
        $: configurable
          ? LiveData.from<boolean | undefined>(
              // Combina cambios en localStorage Y en serverOverrides$ para reactividad
              combineLatest([
                this.globalState.watch<boolean>(FLAG_PREFIX + flagKey),
                this.serverOverrides$,
              ]).pipe(
                map(([localValue, serverOverrides]) => {
                  if (localValue !== undefined) return localValue;
                  const serverValue = serverOverrides[flagKey];
                  if (serverValue !== undefined) return serverValue;
                  return defaultState;
                })
              ),
              getValue()
            )
          : LiveData.from(NEVER, defaultState),
      } as Flag<typeof flag>;

      Object.defineProperty(this, flagKey, {
        get: () => {
          return item;
        },
      });
    });
  }

  /**
   * Carga los overrides de feature flags del servidor (admin panel → BD).
   * Endpoint público: /api/setup/feature-flags
   * Las claves usan snake_case igual que los flags del cliente.
   * Ejemplo: "enable_ai_playground", "enable_theme_editor".
   */
  private async _loadServerFlags(): Promise<void> {
    try {
      const res = await fetch('/api/setup/feature-flags');
      if (!res.ok) return;
      const data = await res.json();
      const flags = data?.flags;
      if (flags && typeof flags === 'object') {
        this.serverOverrides$.next(flags as Record<string, boolean>);
      }
    } catch {
      // Red no disponible, servidor offline, etc. — ignorar silenciosamente
    }
  }
}

export type FlagsExt = Flags & {
  [K in keyof AFFINE_FLAGS]: Flag<AFFINE_FLAGS[K]>;
};
