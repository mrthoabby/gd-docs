// [SELFHOST PATCH] LicenseModule simplificado — sin dependencias externas.
// El sistema de licencias completo fue eliminado en GD docs self-hosted.
// LicenseService es un stub no-op; LicenseResolver mantiene compatibilidad GraphQL.
import { Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { LicenseResolver } from './resolver';
import { LicenseService } from './service';

@Module({
  imports: [PermissionModule],
  providers: [LicenseService, LicenseResolver],
})
export class LicenseModule {}
