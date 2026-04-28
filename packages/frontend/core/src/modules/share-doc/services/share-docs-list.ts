import { Service } from '@toeverything/infra';

import { ShareDocsList } from '../entities/share-docs-list';

export class ShareDocsListService extends Service {
  constructor() {
    super();
  }

  shareDocs = this.framework.createEntity(ShareDocsList);

  override dispose(): void {
    this.shareDocs?.dispose();
  }
}
