import { Injectable } from '@nestjs/common';

import { BaseModel } from './base';

export type ContainerStatus = 'active' | 'trashed';

export interface WorkspaceContainerRecord {
  id: string;
  workspaceId: string;
  name: string;
  status: ContainerStatus;
  createdBy: string;
  updatedBy?: string | null;
  deletedBy?: string | null;
  lastParentFolderNodeId?: string | null;
  lastIndex?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

@Injectable()
export class ContainerModel extends BaseModel {
  private get table() {
    return (this.db as any).workspaceContainer;
  }

  async create(input: {
    id?: string;
    workspaceId: string;
    name: string;
    createdBy: string;
    lastParentFolderNodeId?: string | null;
    lastIndex?: string | null;
  }): Promise<WorkspaceContainerRecord> {
    return this.table.create({
      data: {
        id: input.id,
        workspaceId: input.workspaceId,
        name: input.name,
        createdBy: input.createdBy,
        lastParentFolderNodeId: input.lastParentFolderNodeId,
        lastIndex: input.lastIndex,
      },
    });
  }

  async get(id: string): Promise<WorkspaceContainerRecord | null> {
    return this.table.findUnique({ where: { id } });
  }

  async getActive(id: string): Promise<WorkspaceContainerRecord | null> {
    return this.table.findFirst({
      where: { id, status: 'active', deletedAt: null },
    });
  }

  async list(
    workspaceId: string,
    status: ContainerStatus = 'active'
  ): Promise<WorkspaceContainerRecord[]> {
    return this.table.findMany({
      where: {
        workspaceId,
        status,
        deletedAt: status === 'active' ? null : undefined,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async rename(id: string, name: string, userId: string) {
    return this.table.update({
      where: { id },
      data: { name, updatedBy: userId },
    });
  }

  async trash(
    id: string,
    userId: string,
    restoreMeta?: {
      lastParentFolderNodeId?: string | null;
      lastIndex?: string | null;
    }
  ) {
    return this.table.update({
      where: { id },
      data: {
        status: 'trashed',
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
        lastParentFolderNodeId: restoreMeta?.lastParentFolderNodeId,
        lastIndex: restoreMeta?.lastIndex,
      },
    });
  }

  async restore(id: string, userId: string) {
    return this.table.update({
      where: { id },
      data: {
        status: 'active',
        deletedAt: null,
        deletedBy: null,
        updatedBy: userId,
      },
    });
  }
}
