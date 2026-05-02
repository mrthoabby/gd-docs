import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { BadRequest, NotFound, ValidationError } from '../../../base';
import type {
  KnowledgeBaseSourceInput,
  KnowledgeBaseSourceOverride,
  KnowledgeBaseSourceType,
  KnowledgeBaseStatus,
  WorkspaceKnowledgeBaseRecord,
} from '../../../models';
import { Models } from '../../../models';
import type { CurrentUser } from '../../auth';
import { AccessController, WorkspacePolicyService } from '../../permission';

const DEFAULT_NAME = 'Knowledge Base';
const MAX_NAME_LENGTH = 120;
const MAX_SELECTION_LINES = 2000;
const MAX_SELECTION_CHARS = 120_000;

function normalizeKnowledgeBaseName(name?: string | null) {
  const normalized = (name || DEFAULT_NAME)
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '');
  if (!normalized) {
    throw new ValidationError(
      { errors: 'Invalid knowledge base name' },
      'Knowledge Base name is required.'
    );
  }
  if (normalized.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      { errors: 'Knowledge Base name is too long' },
      `Knowledge Base name must be ${MAX_NAME_LENGTH} characters or fewer.`
    );
  }
  return normalized;
}

function normalizeSelectionCreateDocMinLines(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new ValidationError(
      { errors: 'Invalid selection threshold' },
      'Selection line threshold must be between 1 and 100.'
    );
  }
  return value;
}

function normalizeSelectionText(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    throw new ValidationError(
      { errors: 'Invalid selection' },
      'Selection cannot be empty.'
    );
  }
  if (normalized.length > MAX_SELECTION_CHARS) {
    throw new ValidationError(
      { errors: 'Selection is too large' },
      'Selection is too large to create a document directly.'
    );
  }
  const lineCount = normalized.split('\n').length;
  if (lineCount > MAX_SELECTION_LINES) {
    throw new ValidationError(
      { errors: 'Selection has too many lines' },
      'Selection has too many lines to create a document directly.'
    );
  }
  return { text: normalized, lineCount };
}

function titleFromSelection(text: string) {
  const title =
    text
      .split('\n')
      .map(line => line.replace(/^#+\s+/, '').trim())
      .find(Boolean)
      ?.slice(0, 80) || 'Documento desde Knowledge Base';
  return title;
}

function normalizeSource(input: KnowledgeBaseSourceInput) {
  const sourceType = input.sourceType;
  if (
    sourceType !== 'doc' &&
    sourceType !== 'container' &&
    sourceType !== 'containerFile' &&
    sourceType !== 'blob'
  ) {
    throw new ValidationError(
      { errors: 'Invalid source type' },
      'Knowledge Base source type is invalid.'
    );
  }
  const sourceId = input.sourceId.trim();
  if (!sourceId) {
    throw new ValidationError(
      { errors: 'Invalid source id' },
      'Knowledge Base source id is required.'
    );
  }
  return {
    sourceType,
    sourceId,
    parentFolderNodeId: input.parentFolderNodeId || null,
    contentHash: input.contentHash || null,
  };
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly ac: AccessController,
    private readonly policy: WorkspacePolicyService,
    private readonly models: Models
  ) {}

  async createKnowledgeBase(
    user: CurrentUser,
    input: {
      workspaceId: string;
      folderNodeId: string;
      name?: string | null;
      index?: string | null;
    }
  ) {
    await this.assertCanWrite(user.id, input.workspaceId);
    const folderNodeId = input.folderNodeId.trim();
    if (!folderNodeId) {
      throw new ValidationError(
        { errors: 'Invalid folder node id' },
        'Knowledge Base must be created inside a folder.'
      );
    }
    const existing = await this.models.knowledgeBase.findActiveByFolder(
      input.workspaceId,
      folderNodeId
    );
    if (existing) {
      throw new BadRequest('This folder already has an active Knowledge Base.');
    }

    return this.models.knowledgeBase.create({
      workspaceId: input.workspaceId,
      folderNodeId,
      name: normalizeKnowledgeBaseName(input.name),
      createdBy: user.id,
      index: input.index,
    });
  }

  async getKnowledgeBase(user: CurrentUser, id: string) {
    const knowledgeBase = await this.models.knowledgeBase.get(id);
    if (!knowledgeBase) {
      throw new NotFound('Knowledge Base not found.');
    }
    await this.assertCanRead(user.id, knowledgeBase.workspaceId);
    return knowledgeBase;
  }

  async listKnowledgeBases(
    user: CurrentUser,
    workspaceId: string,
    status: KnowledgeBaseStatus = 'active'
  ) {
    await this.assertCanRead(user.id, workspaceId);
    return this.models.knowledgeBase.list(workspaceId, status);
  }

  async renameKnowledgeBase(user: CurrentUser, id: string, name: string) {
    const knowledgeBase = await this.requireKnowledgeBase(id);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    return this.models.knowledgeBase.rename(
      id,
      normalizeKnowledgeBaseName(name),
      user.id
    );
  }

  async trashKnowledgeBase(
    user: CurrentUser,
    id: string,
    restoreMeta?: {
      lastParentFolderNodeId?: string | null;
      lastIndex?: string | null;
    }
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(id);
    await this.assertCanDelete(user.id, knowledgeBase.workspaceId);
    return this.models.knowledgeBase.trash(id, user.id, restoreMeta);
  }

  async restoreKnowledgeBase(user: CurrentUser, id: string) {
    const knowledgeBase = await this.models.knowledgeBase.get(id);
    if (!knowledgeBase) {
      throw new NotFound('Knowledge Base not found.');
    }
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    const existing = await this.models.knowledgeBase.findActiveByFolder(
      knowledgeBase.workspaceId,
      knowledgeBase.folderNodeId
    );
    if (existing && existing.id !== knowledgeBase.id) {
      throw new BadRequest('This folder already has an active Knowledge Base.');
    }
    return this.models.knowledgeBase.restore(id, user.id);
  }

  async updateKnowledgeBaseSettings(
    user: CurrentUser,
    id: string,
    input: {
      includeSubfolders?: boolean | null;
      selectionCreateDocMinLines?: number | null;
    }
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(id);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);

    const settings: {
      includeSubfolders?: boolean;
      selectionCreateDocMinLines?: number;
    } = {};
    if (typeof input.includeSubfolders === 'boolean') {
      settings.includeSubfolders = input.includeSubfolders;
    }
    if (input.selectionCreateDocMinLines != null) {
      settings.selectionCreateDocMinLines = normalizeSelectionCreateDocMinLines(
        input.selectionCreateDocMinLines
      );
    }
    return this.models.knowledgeBase.updateSettings(id, user.id, settings);
  }

  async moveKnowledgeBase(
    user: CurrentUser,
    id: string,
    input: {
      folderNodeId: string;
      index?: string | null;
    }
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(id);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    const folderNodeId = input.folderNodeId.trim();
    if (!folderNodeId) {
      throw new ValidationError(
        { errors: 'Invalid folder node id' },
        'Knowledge Base must live inside a folder.'
      );
    }
    const existing = await this.models.knowledgeBase.findActiveByFolder(
      knowledgeBase.workspaceId,
      folderNodeId
    );
    if (existing && existing.id !== id) {
      throw new BadRequest('This folder already has an active Knowledge Base.');
    }
    return this.models.knowledgeBase.move(id, user.id, {
      folderNodeId,
      index: input.index,
    });
  }

  async listKnowledgeBaseSources(user: CurrentUser, knowledgeBaseId: string) {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    await this.assertCanRead(user.id, knowledgeBase.workspaceId);
    return this.models.knowledgeBaseSource.list(knowledgeBaseId);
  }

  async syncKnowledgeBaseSources(
    user: CurrentUser,
    knowledgeBaseId: string,
    sources: KnowledgeBaseSourceInput[]
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    const normalized = sources.map(normalizeSource);
    return this.models.knowledgeBaseSource.replaceAutoSources({
      workspaceId: knowledgeBase.workspaceId,
      knowledgeBaseId,
      sources: normalized,
    });
  }

  async updateKnowledgeBaseSourceOverrides(
    user: CurrentUser,
    knowledgeBaseId: string,
    overrides: {
      sourceType: KnowledgeBaseSourceType;
      sourceId: string;
      manualOverride?: KnowledgeBaseSourceOverride | null;
    }[]
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    return this.models.knowledgeBaseSource.updateOverrides(
      knowledgeBaseId,
      overrides.map(override => {
        const source = normalizeSource({
          sourceType: override.sourceType,
          sourceId: override.sourceId,
        });
        return {
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          manualOverride: override.manualOverride ?? null,
        };
      })
    );
  }

  async reindexKnowledgeBase(user: CurrentUser, knowledgeBaseId: string) {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    return this.models.knowledgeBaseSource.markReindexed(knowledgeBaseId);
  }

  async askKnowledgeBase(
    user: CurrentUser,
    knowledgeBaseId: string,
    question: string
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    await this.assertCanAsk(user.id, knowledgeBase.workspaceId);
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) {
      throw new ValidationError(
        { errors: 'Invalid question' },
        'Question cannot be empty.'
      );
    }

    const sources =
      await this.models.knowledgeBaseSource.listIncluded(knowledgeBaseId);
    const indexedSources = sources.filter(source => source.status === 'indexed');

    if (indexedSources.length === 0) {
      return {
        answer:
          'No encontré contenido indexado suficiente dentro de esta Knowledge Base.',
        sources: [],
      };
    }

    // The response contract is intentionally scoped by knowledgeBaseId. The
    // retrieval provider can replace this conservative answer without changing
    // frontend or GraphQL callers.
    return {
      answer:
        'Encontré fuentes indexadas en esta Knowledge Base, pero el motor de recuperación semántica aún no está conectado para generar una respuesta con citas.',
      sources: indexedSources.slice(0, 8),
    };
  }

  async createDocFromKnowledgeBaseSelection(
    user: CurrentUser,
    knowledgeBaseId: string,
    selection: string
  ) {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    await this.assertCanWrite(user.id, knowledgeBase.workspaceId);
    const normalized = normalizeSelectionText(selection);
    if (normalized.lineCount < knowledgeBase.selectionCreateDocMinLines) {
      throw new ValidationError(
        { errors: 'Selection is too short' },
        'Selection does not meet the configured line threshold.'
      );
    }

    return {
      id: randomUUID(),
      workspaceId: knowledgeBase.workspaceId,
      folderNodeId: knowledgeBase.folderNodeId,
      title: titleFromSelection(normalized.text),
      content: normalized.text,
    };
  }

  private async requireKnowledgeBase(
    id: string
  ): Promise<WorkspaceKnowledgeBaseRecord> {
    const knowledgeBase = await this.models.knowledgeBase.getActive(id);
    if (!knowledgeBase) {
      throw new NotFound('Knowledge Base not found.');
    }
    return knowledgeBase;
  }

  private async assertCanRead(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.KnowledgeBase.Read');
  }

  private async assertCanWrite(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.KnowledgeBase.Write');
    await this.policy.assertWorkspaceActionAllowed(
      workspaceId,
      'Workspace.KnowledgeBase.Write'
    );
  }

  private async assertCanDelete(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.KnowledgeBase.Delete');
    await this.policy.assertWorkspaceActionAllowed(
      workspaceId,
      'Workspace.KnowledgeBase.Delete'
    );
  }

  private async assertCanAsk(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.KnowledgeBase.Ask');
  }
}
