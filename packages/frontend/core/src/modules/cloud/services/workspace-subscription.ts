import { Service } from '@toeverything/infra';

import { WorkspaceSubscription } from '../entities/workspace-subscription';

export class WorkspaceSubscriptionService extends Service {
  subscription = this.framework.createEntity(WorkspaceSubscription);
}
