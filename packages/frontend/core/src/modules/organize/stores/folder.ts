import { Store } from '@toeverything/infra';

import type { WorkspaceDBService } from '../../db';

type FolderLinkType = 'doc' | 'tag' | 'collection' | 'container';

export class FolderStore extends Store {
  constructor(private readonly dbService: WorkspaceDBService) {
    super();
  }

  watchNodeInfo(nodeId: string) {
    return this.dbService.db.folders.get$(nodeId);
  }

  watchNodeChildren(parentId: string | null) {
    return this.dbService.db.folders.find$({
      parentId: parentId,
    });
  }

  watchIsLoading() {
    return this.dbService.db.folders.isLoading$;
  }

  getNode(nodeId: string) {
    return this.dbService.db.folders.get(nodeId);
  }

  getRootFolders() {
    return this.dbService.db.folders.find({
      parentId: null,
    });
  }

  findLink(type: FolderLinkType, targetId: string) {
    return this.dbService.db.folders
      .find({
        type,
        data: targetId,
      })
      .at(0);
  }

  findRootFolderByName(name: string) {
    return this.getRootFolders().find(
      node => node.type === 'folder' && node.data === name
    );
  }

  isAncestor(childId: string, ancestorId: string): boolean {
    if (childId === ancestorId) {
      return false;
    }
    const history = new Set<string>([childId]);
    let current: string = childId;
    while (current) {
      const info = this.dbService.db.folders.get(current);
      if (info === null || !info.parentId) {
        return false;
      }
      current = info.parentId;
      if (history.has(current)) {
        return false; // loop detected
      }
      history.add(current);
      if (current === ancestorId) {
        return true;
      }
    }
    return false;
  }

  createLink(
    parentId: string,
    type: FolderLinkType,
    nodeId: string,
    index: string
  ) {
    const parent = this.dbService.db.folders.get(parentId);
    if (parent === null || parent.type !== 'folder') {
      throw new Error('Parent folder not found');
    }

    this.dbService.db.folders.create({
      parentId,
      type,
      data: nodeId,
      index: index,
    });
  }

  renameNode(nodeId: string, name: string) {
    const node = this.dbService.db.folders.get(nodeId);
    if (node === null) {
      throw new Error('Node not found');
    }
    if (node.type !== 'folder') {
      throw new Error('Cannot rename non-folder node');
    }
    this.dbService.db.folders.update(nodeId, {
      data: name,
    });
  }

  createFolder(parentId: string | null, name: string, index: string) {
    if (parentId) {
      const parent = this.dbService.db.folders.get(parentId);
      if (parent === null || parent.type !== 'folder') {
        throw new Error('Parent folder not found');
      }
    }

    return this.dbService.db.folders.create({
      parentId: parentId,
      type: 'folder',
      data: name,
      index: index,
    }).id;
  }

  removeFolder(folderId: string) {
    const info = this.dbService.db.folders.get(folderId);
    if (info === null || info.type !== 'folder') {
      throw new Error('Folder not found');
    }
    const stack = [info];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      if (current.type !== 'folder') {
        this.dbService.db.folders.delete(current.id);
      } else {
        const children = this.dbService.db.folders.find({
          parentId: current.id,
        });
        stack.push(...children);
        this.dbService.db.folders.delete(current.id);
      }
    }
  }

  collectLinkedNodeData(folderId: string, type: 'container') {
    const info = this.dbService.db.folders.get(folderId);
    if (info === null || info.type !== 'folder') {
      throw new Error('Folder not found');
    }

    const ids: string[] = [];
    const stack = [info];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      if (current.type === 'folder') {
        stack.push(...this.dbService.db.folders.find({ parentId: current.id }));
      } else if (current.type === type) {
        ids.push(current.data);
      }
    }
    return ids;
  }

  removeLink(linkId: string) {
    const link = this.dbService.db.folders.get(linkId);
    if (link === null || link.type === 'folder') {
      throw new Error('Link not found');
    }
    this.dbService.db.folders.delete(linkId);
  }

  moveNode(nodeId: string, parentId: string | null, index: string) {
    const node = this.dbService.db.folders.get(nodeId);
    if (node === null) {
      throw new Error('Node not found');
    }

    if (parentId) {
      if (nodeId === parentId) {
        throw new Error('Cannot move a node to itself');
      }
      if (this.isAncestor(parentId, nodeId)) {
        throw new Error('Cannot move a node to its descendant');
      }
      const parent = this.dbService.db.folders.get(parentId);
      if (parent === null || parent.type !== 'folder') {
        throw new Error('Parent folder not found');
      }
    } else {
      if (node.type !== 'folder') {
        throw new Error('Root node can only have folders');
      }
    }
    this.dbService.db.folders.update(nodeId, {
      parentId,
      index,
    });
  }
}
