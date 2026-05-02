import { Injectable } from '@nestjs/common';

import { BaseModel } from './base';

export type KnowledgeBaseStatus = 'active' | 'trashed';

export interface WorkspaceKnowledgeBaseRecord {
  id: string;
  workspaceId: string;
  folderNodeId: string;
  name: string;
  includeSubfolders: boolean;
  selectionCreateDocMinLines: number;
  status: KnowledgeBaseStatus;
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
export class KnowledgeBaseModel extends BaseModel {
  private get table() {
    return (this.db as any).workspaceKnowledgeBase;
  }

  async create(input: {
    workspaceId: string;
    folderNodeId: string;
    name: string;
    createdBy: string;
    index?: string | null;
  }): Promise<WorkspaceKnowledgeBaseRecord> {
    return this.table.create({
      data: {
        workspaceId: input.workspaceId,
        folderNodeId: input.folderNodeId,
        name: input.name,
        createdBy: input.createdBy,
        lastParentFolderNodeId: input.folderNodeId,
        lastIndex: input.index,
      },
    });
  }

  async get(id: string): Promise<WorkspaceKnowledgeBaseRecord | null> {
    return this.table.findUnique({ where: { id } });
  }

  async getActive(id: string): Promise<WorkspaceKnowledgeBaseRecord | null> {
    return this.table.findFirst({
      where: { id, status: 'active', deletedAt: null },
    });
  }

  async findActiveByFolder(
    workspaceId: string,
    folderNodeId: string
  ): Promise<WorkspaceKnowledgeBaseRecord | null> {
    return this.table.findFirst({
      where: {
        workspaceId,
        folderNodeId,
        status: 'active',
        deletedAt: null,
      },
    });
  }

  async list(
    workspaceId: string,
    status: KnowledgeBaseStatus = 'active'
  ): Promise<WorkspaceKnowledgeBaseRecord[]> {
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

  async updateSettings(
    id: string,
    userId: string,
    input: {
      includeSubfolders?: boolean;
      selectionCreateDocMinLines?: number;
    }
  ) {
    return this.table.update({
      where: { id },
      data: {
        includeSubfolders: input.includeSubfolders,
        selectionCreateDocMinLines: input.selectionCreateDocMinLines,
        updatedBy: userId,
      },
    });
  }

  async move(
    id: string,
    userId: string,
    input: {
      folderNodeId: string;
      index?: string | null;
    }
  ) {
    return this.table.update({
      where: { id },
      data: {
        folderNodeId: input.folderNodeId,
        lastParentFolderNodeId: input.folderNodeId,
        lastIndex: input.index,
        updatedBy: userId,
      },
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
