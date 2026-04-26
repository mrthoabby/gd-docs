import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  ActionForbidden,
  Config,
  InternalServerError,
  Mutex,
  PasswordRequired,
  UseNamedGuard,
} from '../../base';
import { Models } from '../../models';
import { AuthService, Public } from '../auth';
import { ServerService } from '../config';
import { FeatureService } from '../features';
import { validators } from '../utils/validators';

interface CreateUserInput {
  name?: string;
  email: string;
  password: string;
}

@UseNamedGuard('selfhost')
@Controller('/api/setup')
export class CustomSetupController {
  constructor(
    private readonly config: Config,
    private readonly models: Models,
    private readonly auth: AuthService,
    private readonly mutex: Mutex,
    private readonly server: ServerService,
    private readonly feature: FeatureService
  ) {}

  @Public()
  @Post('/create-admin-user')
  async createAdmin(
    @Req() req: Request,
    @Res() res: Response,
    @Body() input: CreateUserInput
  ) {
    if (await this.server.initialized()) {
      throw new ActionForbidden('First user already created');
    }

    validators.assertValidEmail(input.email);

    if (!input.password) {
      throw new PasswordRequired();
    }

    validators.assertValidPassword(
      input.password,
      this.config.auth.passwordRequirements
    );

    await using lock = await this.mutex.acquire('createFirstAdmin');

    if (!lock) {
      throw new InternalServerError();
    }
    const user = await this.models.user.create({
      name: input.name || undefined,
      email: input.email,
      password: input.password,
      registered: true,
    });

    try {
      await this.models.userFeature.add(
        user.id,
        'administrator',
        'selfhost setup'
      );

      await this.auth.setCookies(req, res, user.id);
      res.send({ id: user.id, email: user.email, name: user.name });
    } catch (e) {
      await this.models.user.delete(user.id);
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // [SELFHOST PATCH] Endpoints para el Panel Root Admin
  // Permiten leer y persistir feature flag overrides en la BD del servidor.
  // -------------------------------------------------------------------------

  /**
   * GET /api/setup/feature-flags  (público)
   * Devuelve los overrides de feature flags guardados por el admin.
   * Accesible por CUALQUIER usuario (incluso no autenticados) porque los flags
   * son solo configuración de UI, no datos sensibles.
   * El cliente web los lee al arrancar para inicializar el sistema de flags.
   */
  @Public()
  @Public()
  @Get('/feature-flags')
  async getFeatureFlags(@Res() res: Response) {
    const flags = await this._readFlagOverrides();
    return res.json({ flags });
  }

  /**
   * GET /api/setup/admin-flags  (requiere admin)
   * Igual que /feature-flags pero solo accesible por administradores.
   * Usado por el panel root para leer el estado actual.
   */
  @Get('/admin-flags')
  async getAdminFlags(@Req() req: Request, @Res() res: Response) {
    await this.requireAdminSession(req, res);
    const flags = await this._readFlagOverrides();
    return res.json({ flags });
  }

  private async _readFlagOverrides(): Promise<Record<string, boolean>> {
    const allConfigs = await this.models.appConfig.load();
    const PREFIX = 'flags.';
    const flags: Record<string, boolean> = {};
    for (const cfg of allConfigs) {
      if (cfg.id.startsWith(PREFIX)) {
        const key = cfg.id.slice(PREFIX.length);
        flags[key] = Boolean(cfg.value);
      }
    }
    return flags;
  }

  /**
   * POST /api/setup/admin-flags
   * Guarda overrides de feature flags en la BD del servidor y actualiza
   * la configuración en memoria para que otros procesos vean el cambio
   * inmediatamente (sin necesidad de reiniciar el servidor).
   * Body: { flags: { [key: string]: boolean } }
   */
  @Post('/admin-flags')
  async setAdminFlags(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { flags: Record<string, boolean> }
  ) {
    const userId = await this.requireAdminSession(req, res);
    if (!userId) return; // res ya fue enviado (403/redirect)

    const flags = body?.flags;
    if (!flags || typeof flags !== 'object') {
      return res.status(400).json({ error: 'Body debe tener { flags: {...} }' });
    }

    const updates = Object.entries(flags).map(([key, value]) => ({
      key: `flags.${key}`,
      value,
    }));

    // 1. Persistir en BD
    await this.models.appConfig.save(userId, updates);

    // 2. Sincronizar la config en memoria recargando todos los overrides de BD.
    //    Esto garantiza que el GET inmediato (y cualquier lógica interna como
    //    onFlagsChanged) vea los valores recién guardados sin reiniciar.
    await this.server.revalidateConfig();

    return res.json({ ok: true, saved: Object.keys(flags).length });
  }

  /**
   * Verifica que la request tenga una sesión de usuario admin activa.
   * Retorna el userId si OK, o envía 403 y retorna null si no.
   */
  private async requireAdminSession(
    req: Request,
    res: Response
  ): Promise<string | null> {
    try {
      const { sessionId, userId } =
        this.auth.getSessionOptionsFromRequest(req);

      if (!sessionId) {
        res.status(401).json({ error: 'No autenticado' });
        return null;
      }

      const userSession = await this.auth.getUserSession(sessionId, userId);
      if (!userSession) {
        res.status(401).json({ error: 'Sesión inválida' });
        return null;
      }

      const isAdmin = await this.feature.isAdmin(userSession.user.id);
      if (!isAdmin) {
        res.status(403).json({ error: 'Se requiere rol de administrador' });
        return null;
      }

      return userSession.user.id;
    } catch {
      res.status(500).json({ error: 'Error interno verificando sesión' });
      return null;
    }
  }
}
