import {
  generateFractionalIndexingKeyBetween,
  Service,
} from '@toeverything/infra';

import { FolderTree } from '../entities/folder-tree';
import type { FolderStore } from '../stores/folder';

export class OrganizeService extends Service {
  constructor(private readonly folderStore: FolderStore) {
    super();
  }

  folderTree = this.framework.createEntity(FolderTree);

  restoreContainerLink(
    containerId: string,
    options: {
      fallbackFolderName: string;
      index?: string | null;
      parentFolderNodeId?: string | null;
    }
  ) {
    const existing = this.folderStore.findLink('container', containerId);
    if (existing) {
      return existing.parentId ?? null;
    }

    let parentId = options.parentFolderNodeId ?? null;
    if (!parentId || this.folderStore.getNode(parentId)?.type !== 'folder') {
      const fallbackFolder =
        this.folderStore.findRootFolderByName(options.fallbackFolderName) ??
        this.createFallbackFolder(options.fallbackFolderName);
      parentId = fallbackFolder.id;
    }

    this.folderStore.createLink(
      parentId,
      'container',
      containerId,
      options.index || generateFractionalIndexingKeyBetween(null, null)
    );

    return parentId;
  }

  private createFallbackFolder(name: string) {
    const rootFolders = this.folderStore
      .getRootFolders()
      .filter(node => node.type === 'folder')
      .sort((a, b) => (a.index > b.index ? 1 : -1));
    const lastRootFolder = rootFolders.at(-1);
    const index = generateFractionalIndexingKeyBetween(
      lastRootFolder?.index ?? null,
      null
    );

    const id = this.folderStore.createFolder(null, name, index);
    const folder = this.folderStore.getNode(id);
    if (!folder || folder.type !== 'folder') {
      throw new Error('Failed to create fallback folder');
    }
    return folder;
  }
}
