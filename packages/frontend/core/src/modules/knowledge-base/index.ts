export {
  KnowledgeBaseService,
  type KnowledgeBaseAskResult,
  type KnowledgeBaseSelectionDocDraft,
  type KnowledgeBaseSourceInput,
  type KnowledgeBaseSourceOverride,
  type KnowledgeBaseSourceStatus,
  type KnowledgeBaseSourceType,
  type KnowledgeBaseStatus,
  type WorkspaceKnowledgeBase,
  type WorkspaceKnowledgeBaseSource,
} from './services/knowledge-base';

import { type Framework } from '@toeverything/infra';

import { DefaultServerService, WorkspaceServerService } from '../cloud';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { KnowledgeBaseService } from './services/knowledge-base';

export function configureKnowledgeBaseModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(KnowledgeBaseService, [
      WorkspaceService,
      WorkspaceServerService,
      DefaultServerService,
    ]);
}
