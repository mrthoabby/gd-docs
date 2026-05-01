export {
  ContainerService,
  type ContainerFileKind,
  type ContainerFileStatus,
  type ContainerStatus,
  type WorkspaceContainer,
  type WorkspaceContainerFile,
} from './services/container';

import { type Framework } from '@toeverything/infra';

import { DefaultServerService, WorkspaceServerService } from '../cloud';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { ContainerService } from './services/container';

export function configureContainerModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(ContainerService, [
      WorkspaceService,
      WorkspaceServerService,
      DefaultServerService,
    ]);
}
