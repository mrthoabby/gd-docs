import { Module } from '@nestjs/common';

import { DocStorageModule } from '../doc';
import { DocRendererModule } from '../doc-renderer';
import { FeatureModule } from '../features';
import { MailModule } from '../mail';
import { NotificationModule } from '../notification';
import { PermissionModule } from '../permission';
import { QuotaModule } from '../quota';
import { StorageModule } from '../storage';
import { UserModule } from '../user';
import { ContainerService, WorkspaceContainerResolver } from './container';
import { WorkspacesController } from './controller';
import { WorkspaceEvents } from './event';
import {
  DocHistoryResolver,
  DocResolver,
  WorkspaceBlobResolver,
  WorkspaceDocResolver,
  WorkspaceMemberResolver,
  WorkspaceResolver,
} from './resolvers';
import { AdminWorkspaceResolver } from './resolvers/admin';
import { WorkspaceService } from './service';
import { WorkspaceStatsJob } from './stats.job';

@Module({
  imports: [
    DocStorageModule,
    DocRendererModule,
    FeatureModule,
    QuotaModule,
    StorageModule,
    UserModule,
    PermissionModule,
    NotificationModule,
    MailModule,
  ],
  controllers: [WorkspacesController],
  providers: [
    WorkspaceResolver,
    WorkspaceMemberResolver,
    WorkspaceDocResolver,
    DocResolver,
    DocHistoryResolver,
    WorkspaceBlobResolver,
    WorkspaceContainerResolver,
    WorkspaceService,
    ContainerService,
    WorkspaceEvents,
    AdminWorkspaceResolver,
    WorkspaceStatsJob,
  ],
  exports: [WorkspaceService, ContainerService],
})
export class WorkspaceModule {}

export { ContainerService } from './container';
export { WorkspaceService } from './service';
export { InvitationType, WorkspaceType } from './types';
