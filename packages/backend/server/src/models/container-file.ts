import { Injectable } from '@nestjs/common';

import { BaseModel } from './base';

export type ContainerFileKind = 'image' | 'text' | 'pdf' | 'directory';
export type ContainerFileStatus = 'pending' | 'active' | 'deleted';

export interface WorkspaceContainerFileRecord {
  id: string;
  workspaceId: string;
  containerId: string;
  blobKey: string;
  name: string;
  kind: ContainerFileKind;
  mime: string;
  size: number;
  revision: number;
  status: ContainerFileStatus;
  createdBy: string;
  updatedBy?: string | null;
  deletedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

@Injectable()
export class ContainerFileModel extends BaseModel {
  private get table() {
    return (this.db as any).workspaceContainerFile;
  }

  async create(input: {
    id: string;
    workspaceId: string;
    containerId: string;
    blobKey: string;
    name: string;
    kind: ContainerFileKind;
    mime: string;
    size: number;
    createdBy: string;
    status?: ContainerFileStatus;
  }): Promise<WorkspaceContainerFileRecord> {
    return this.table.create({
      data: {
        ...input,
        status: input.status ?? 'pending',
      },
    });
  }

  async get(id: string): Promise<WorkspaceContainerFileRecord | null> {
    return this.table.findUnique({ where: { id } });
  }

  async getActive(id: string): Promise<WorkspaceContainerFileRecord | null> {
    return this.table.findFirst({
      where: { id, status: 'active', deletedAt: null },
    });
  }

  async list(containerId: string): Promise<WorkspaceContainerFileRecord[]> {
    return this.table.findMany({
      where: { containerId, status: 'active', deletedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
  }

  async listByNamePrefix(
    containerId: string,
    prefix: string
  ): Promise<WorkspaceContainerFileRecord[]> {
    return this.table.findMany({
      where: {
        containerId,
        status: 'active',
        deletedAt: null,
        name: { startsWith: prefix, mode: 'insensitive' },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findActiveByName(containerId: string, name: string) {
    return this.table.findFirst({
      where: {
        containerId,
        status: 'active',
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  async activate(id: string) {
    return this.table.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async rename(id: string, name: string, userId: string) {
    return this.table.update({
      where: { id },
      data: { name, updatedBy: userId },
    });
  }

  async renameMany(
    input: { id: string; name: string }[],
    userId: string
  ): Promise<WorkspaceContainerFileRecord[]> {
    return (this.db as any).$transaction(
      input.map(item =>
        this.table.update({
          where: { id: item.id },
          data: { name: item.name, updatedBy: userId },
        })
      )
    );
  }

  async updateText(input: {
    id: string;
    blobKey: string;
    size: number;
    mime: string;
    revision: number;
    userId: string;
  }) {
    return this.table.update({
      where: { id: input.id },
      data: {
        blobKey: input.blobKey,
        size: input.size,
        mime: input.mime,
        revision: input.revision,
        updatedBy: input.userId,
      },
    });
  }

  async delete(id: string, userId: string) {
    return this.table.update({
      where: { id },
      data: {
        status: 'deleted',
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
      },
    });
  }

  async deleteMany(ids: string[], userId: string) {
    return (this.db as any).$transaction(
      ids.map(id =>
        this.table.update({
          where: { id },
          data: {
            status: 'deleted',
            deletedAt: new Date(),
            deletedBy: userId,
            updatedBy: userId,
          },
        })
      )
    );
  }
}
