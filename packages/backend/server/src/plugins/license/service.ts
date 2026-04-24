// [SELFHOST PATCH] Sistema de licencias ELIMINADO para GD docs self-hosted.
//
// En el build original, LicenseService gestionaba licencias de equipo pagadas
// que requerían contactar a app.affine.pro para activar/validar membresías.
//
// En GD docs self-hosted:
// - Todos los workspaces tienen team_plan_v1 otorgado automáticamente
//   (ver QuotaService.getWorkspaceQuota y feature.ts con memberLimit: 99999)
// - No hay límite de miembros ni de almacenamiento por licencia
// - No se contacta ningún servidor externo para validar licencias
//
// Esta clase queda como stub vacío para mantener compatibilidad con el
// esquema GraphQL (los resolvers devuelven null / false / '' según el tipo).

import { Injectable } from '@nestjs/common';

@Injectable()
export class LicenseService {
  /** Siempre devuelve null — no hay licencias instaladas en self-hosted. */
  async getLicense(_workspaceId: string) {
    return null;
  }

  /** No-op — no se pueden instalar licencias en self-hosted sin licenciamiento externo. */
  async installLicense(_workspaceId: string, _license: Buffer) {
    return null;
  }

  /** No-op — no hay servidor de licencias. */
  async activateTeamLicense(_workspaceId: string, _licenseKey: string) {
    return null;
  }

  /** No-op — no hay licencia que eliminar. */
  async removeTeamLicense(_workspaceId: string) {
    return true;
  }

  /** No-op — no hay portal de cliente. */
  async createCustomerPortal(_workspaceId: string) {
    return { url: '' };
  }
}
