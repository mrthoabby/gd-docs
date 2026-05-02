import { Injectable } from '@nestjs/common';

import { BaseModel } from './base';

export type KnowledgeBaseSourceType =
  | 'doc'
  | 'container'
  | 'containerFile'
  | 'blob';
export type KnowledgeBaseSourceStatus =
  | 'pending'
  | 'indexed'
  | 'stale'
  | 'failed';
export type KnowledgeBaseSourceOverride = 'include' | 'exclude';

export interface WorkspaceKnowledgeBaseSourceRecord {
  id: string;
  workspaceId: string;
  knowledgeBaseId: string;
  sourceType: KnowledgeBaseSourceType;
  sourceId: string;
  parentFolderNodeId?: string | null;
  included: boolean;
  manualOverride?: KnowledgeBaseSourceOverride | null;
  status: KnowledgeBaseSourceStatus;
  contentHash?: string | null;
  indexedAt?: Date | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBaseSourceInput {
  sourceType: KnowledgeBaseSourceType;
  sourceId: string;
  parentFolderNodeId?: string | null;
  contentHash?: string | null;
}

@Injectable()
export class KnowledgeBaseSourceModel extends BaseModel {
  private get table() {
    return (this.db as any).workspaceKnowledgeBaseSource;
  }

  async list(
    knowledgeBaseId: string
  ): Promise<WorkspaceKnowledgeBaseSourceRecord[]> {
    return this.table.findMany({
      where: { knowledgeBaseId },
      orderBy: [{ included: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async listIncluded(
    knowledgeBaseId: string
  ): Promise<WorkspaceKnowledgeBaseSourceRecord[]> {
    return this.table.findMany({
      where: { knowledgeBaseId, included: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async replaceAutoSources(input: {
    workspaceId: string;
    knowledgeBaseId: string;
    sources: KnowledgeBaseSourceInput[];
  }): Promise<WorkspaceKnowledgeBaseSourceRecord[]> {
    const existing = await this.list(input.knowledgeBaseId);
    const existingByKey = new Map(
      existing.map(source => [this.key(source.sourceType, source.sourceId), source])
    );
    const nextKeys = new Set(
      input.sources.map(source => this.key(source.sourceType, source.sourceId))
    );

    await Promise.all(
      input.sources.map(source => {
        const existingSource = existingByKey.get(
          this.key(source.sourceType, source.sourceId)
        );
        const included = existingSource?.manualOverride
          ? existingSource.manualOverride === 'include'
          : true;
        const status =
          existingSource?.contentHash &&
          source.contentHash &&
          existingSource.contentHash === source.contentHash
            ? existingSource.status
            : 'pending';

        return this.table.upsert({
          where: {
            knowledgeBaseId_sourceType_sourceId: {
              knowledgeBaseId: input.knowledgeBaseId,
              sourceType: source.sourceType,
              sourceId: source.sourceId,
            },
          },
          update: {
            parentFolderNodeId: source.parentFolderNodeId,
            contentHash: source.contentHash,
            included,
            status,
            error: null,
          },
          create: {
            workspaceId: input.workspaceId,
            knowledgeBaseId: input.knowledgeBaseId,
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            parentFolderNodeId: source.parentFolderNodeId,
            contentHash: source.contentHash,
            included,
            status,
          },
        });
      })
    );

    await Promise.all(
      existing
        .filter(source => !nextKeys.has(this.key(source.sourceType, source.sourceId)))
        .filter(source => source.manualOverride !== 'include')
        .map(source =>
          this.table.update({
            where: { id: source.id },
            data: {
              included: false,
              status: 'stale',
            },
          })
        )
    );

    return this.list(input.knowledgeBaseId);
  }

  async updateOverrides(
    knowledgeBaseId: string,
    overrides: {
      sourceType: KnowledgeBaseSourceType;
      sourceId: string;
      manualOverride?: KnowledgeBaseSourceOverride | null;
    }[]
  ): Promise<WorkspaceKnowledgeBaseSourceRecord[]> {
    await Promise.all(
      overrides.map(override =>
        this.table.update({
          where: {
            knowledgeBaseId_sourceType_sourceId: {
              knowledgeBaseId,
              sourceType: override.sourceType,
              sourceId: override.sourceId,
            },
          },
          data: {
            manualOverride: override.manualOverride ?? null,
            included:
              override.manualOverride === 'exclude'
                ? false
                : override.manualOverride === 'include'
                  ? true
                  : undefined,
          },
        })
      )
    );
    return this.list(knowledgeBaseId);
  }

  async markReindexed(
    knowledgeBaseId: string
  ): Promise<WorkspaceKnowledgeBaseSourceRecord[]> {
    await this.table.updateMany({
      where: { knowledgeBaseId, included: true },
      data: {
        status: 'indexed',
        indexedAt: new Date(),
        error: null,
      },
    });
    return this.list(knowledgeBaseId);
  }

  private key(sourceType: KnowledgeBaseSourceType, sourceId: string) {
    return `${sourceType}:${sourceId}`;
  }
}
