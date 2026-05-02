import type { GraphQLQuery } from '@affine/graphql';
import { LiveData, Service } from '@toeverything/infra';

import {
  DefaultServerService,
  GraphQLService,
  WorkspaceServerService,
} from '../../cloud';
import type { WorkspaceService } from '../../workspace';

export type KnowledgeBaseStatus = 'active' | 'trashed';
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

export interface WorkspaceKnowledgeBase {
  id: string;
  workspaceId: string;
  folderNodeId: string;
  name: string;
  includeSubfolders: boolean;
  selectionCreateDocMinLines: number;
  status: KnowledgeBaseStatus;
  lastParentFolderNodeId?: string | null;
  lastIndex?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface WorkspaceKnowledgeBaseSource {
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
  indexedAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseSelectionDocDraft {
  id: string;
  workspaceId: string;
  folderNodeId: string;
  title: string;
  content: string;
}

export interface KnowledgeBaseAskResult {
  answer: string;
  sources: WorkspaceKnowledgeBaseSource[];
}

export interface KnowledgeBaseSourceInput {
  sourceType: KnowledgeBaseSourceType;
  sourceId: string;
  parentFolderNodeId?: string | null;
  contentHash?: string | null;
}

const knowledgeBaseFields = `
  id
  workspaceId
  folderNodeId
  name
  includeSubfolders
  selectionCreateDocMinLines
  status
  lastParentFolderNodeId
  lastIndex
  createdAt
  updatedAt
  deletedAt
`;

const sourceFields = `
  id
  workspaceId
  knowledgeBaseId
  sourceType
  sourceId
  parentFolderNodeId
  included
  manualOverride
  status
  contentHash
  indexedAt
  error
  createdAt
  updatedAt
`;

const knowledgeBaseQuery = {
  id: 'knowledgeBase',
  op: 'knowledgeBase',
  query: `query knowledgeBase($id: String!) {
    knowledgeBase(id: $id) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const workspaceKnowledgeBasesQuery = {
  id: 'workspaceKnowledgeBases',
  op: 'workspace',
  query: `query workspaceKnowledgeBases($workspaceId: String!, $status: WorkspaceKnowledgeBaseStatus) {
    workspace(id: $workspaceId) {
      id
      knowledgeBases(status: $status) {
        ${knowledgeBaseFields}
      }
    }
  }`,
} satisfies GraphQLQuery;

const knowledgeBaseSourcesQuery = {
  id: 'knowledgeBaseSources',
  op: 'knowledgeBaseSources',
  query: `query knowledgeBaseSources($knowledgeBaseId: String!) {
    knowledgeBaseSources(knowledgeBaseId: $knowledgeBaseId) {
      ${sourceFields}
    }
  }`,
} satisfies GraphQLQuery;

const createKnowledgeBaseMutation = {
  id: 'createKnowledgeBase',
  op: 'createKnowledgeBase',
  query: `mutation createKnowledgeBase(
    $workspaceId: String!
    $folderNodeId: String!
    $name: String
    $index: String
  ) {
    createKnowledgeBase(
      workspaceId: $workspaceId
      folderNodeId: $folderNodeId
      name: $name
      index: $index
    ) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const renameKnowledgeBaseMutation = {
  id: 'renameKnowledgeBase',
  op: 'renameKnowledgeBase',
  query: `mutation renameKnowledgeBase($id: String!, $name: String!) {
    renameKnowledgeBase(id: $id, name: $name) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const trashKnowledgeBaseMutation = {
  id: 'trashKnowledgeBase',
  op: 'trashKnowledgeBase',
  query: `mutation trashKnowledgeBase(
    $id: String!
    $lastParentFolderNodeId: String
    $lastIndex: String
  ) {
    trashKnowledgeBase(
      id: $id
      lastParentFolderNodeId: $lastParentFolderNodeId
      lastIndex: $lastIndex
    ) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const restoreKnowledgeBaseMutation = {
  id: 'restoreKnowledgeBase',
  op: 'restoreKnowledgeBase',
  query: `mutation restoreKnowledgeBase($id: String!) {
    restoreKnowledgeBase(id: $id) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const updateKnowledgeBaseSettingsMutation = {
  id: 'updateKnowledgeBaseSettings',
  op: 'updateKnowledgeBaseSettings',
  query: `mutation updateKnowledgeBaseSettings(
    $id: String!
    $includeSubfolders: Boolean
    $selectionCreateDocMinLines: Int
  ) {
    updateKnowledgeBaseSettings(
      id: $id
      includeSubfolders: $includeSubfolders
      selectionCreateDocMinLines: $selectionCreateDocMinLines
    ) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const moveKnowledgeBaseMutation = {
  id: 'moveKnowledgeBase',
  op: 'moveKnowledgeBase',
  query: `mutation moveKnowledgeBase(
    $id: String!
    $folderNodeId: String!
    $index: String
  ) {
    moveKnowledgeBase(
      id: $id
      folderNodeId: $folderNodeId
      index: $index
    ) {
      ${knowledgeBaseFields}
    }
  }`,
} satisfies GraphQLQuery;

const syncKnowledgeBaseSourcesMutation = {
  id: 'syncKnowledgeBaseSources',
  op: 'syncKnowledgeBaseSources',
  query: `mutation syncKnowledgeBaseSources(
    $knowledgeBaseId: String!
    $sources: [KnowledgeBaseSourceInput!]!
  ) {
    syncKnowledgeBaseSources(
      knowledgeBaseId: $knowledgeBaseId
      sources: $sources
    ) {
      ${sourceFields}
    }
  }`,
} satisfies GraphQLQuery;

const updateKnowledgeBaseSourceOverridesMutation = {
  id: 'updateKnowledgeBaseSourceOverrides',
  op: 'updateKnowledgeBaseSourceOverrides',
  query: `mutation updateKnowledgeBaseSourceOverrides(
    $knowledgeBaseId: String!
    $overrides: [KnowledgeBaseSourceOverrideInput!]!
  ) {
    updateKnowledgeBaseSourceOverrides(
      knowledgeBaseId: $knowledgeBaseId
      overrides: $overrides
    ) {
      ${sourceFields}
    }
  }`,
} satisfies GraphQLQuery;

const reindexKnowledgeBaseMutation = {
  id: 'reindexKnowledgeBase',
  op: 'reindexKnowledgeBase',
  query: `mutation reindexKnowledgeBase($knowledgeBaseId: String!) {
    reindexKnowledgeBase(knowledgeBaseId: $knowledgeBaseId) {
      ${sourceFields}
    }
  }`,
} satisfies GraphQLQuery;

const askKnowledgeBaseMutation = {
  id: 'askKnowledgeBase',
  op: 'askKnowledgeBase',
  query: `mutation askKnowledgeBase($knowledgeBaseId: String!, $question: String!) {
    askKnowledgeBase(knowledgeBaseId: $knowledgeBaseId, question: $question) {
      answer
      sources {
        ${sourceFields}
      }
    }
  }`,
} satisfies GraphQLQuery;

const createDocFromKnowledgeBaseSelectionMutation = {
  id: 'createDocFromKnowledgeBaseSelection',
  op: 'createDocFromKnowledgeBaseSelection',
  query: `mutation createDocFromKnowledgeBaseSelection(
    $knowledgeBaseId: String!
    $selection: String!
  ) {
    createDocFromKnowledgeBaseSelection(
      knowledgeBaseId: $knowledgeBaseId
      selection: $selection
    ) {
      id
      workspaceId
      folderNodeId
      title
      content
    }
  }`,
} satisfies GraphQLQuery;

export class KnowledgeBaseService extends Service {
  readonly knowledgeBases$ = new LiveData<WorkspaceKnowledgeBase[]>([]);
  readonly sources$ = new LiveData<
    Record<string, WorkspaceKnowledgeBaseSource[]>
  >({});

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceServerService: WorkspaceServerService,
    private readonly defaultServerService: DefaultServerService
  ) {
    super();
  }

  private get server() {
    return (
      this.workspaceServerService.server || this.defaultServerService.server
    );
  }

  private get graphql() {
    return this.server.scope.get(GraphQLService);
  }

  private get workspaceId() {
    return this.workspaceService.workspace.id;
  }

  private async gql<Response>(
    query: GraphQLQuery,
    variables?: Record<string, unknown>,
    options?: { timeout?: number }
  ) {
    return this.graphql.gql({
      query,
      variables,
      ...options,
    } as any) as Promise<Response>;
  }

  knowledgeBase$(id: string) {
    return this.knowledgeBases$.selector(knowledgeBases =>
      knowledgeBases.find(knowledgeBase => knowledgeBase.id === id)
    );
  }

  sourcesFor$(knowledgeBaseId: string) {
    return this.sources$.selector(
      sources => sources[knowledgeBaseId] ?? []
    );
  }

  async revalidate(status: KnowledgeBaseStatus = 'active') {
    const response = await this.gql<{
      workspace?: { knowledgeBases?: WorkspaceKnowledgeBase[] };
    }>(workspaceKnowledgeBasesQuery, {
      workspaceId: this.workspaceId,
      status,
    });
    const knowledgeBases = response.workspace?.knowledgeBases ?? [];
    if (status === 'active') {
      this.knowledgeBases$.next(knowledgeBases);
    }
    return knowledgeBases;
  }

  async loadKnowledgeBase(id: string) {
    const response = await this.gql<{
      knowledgeBase?: WorkspaceKnowledgeBase;
    }>(knowledgeBaseQuery, { id });
    const knowledgeBase = response.knowledgeBase;
    if (!knowledgeBase) {
      return null;
    }
    this.upsertKnowledgeBase(knowledgeBase);
    return knowledgeBase;
  }

  async listSources(knowledgeBaseId: string) {
    const response = await this.gql<{
      knowledgeBaseSources?: WorkspaceKnowledgeBaseSource[];
    }>(knowledgeBaseSourcesQuery, { knowledgeBaseId });
    const sources = response.knowledgeBaseSources ?? [];
    this.setSources(knowledgeBaseId, sources);
    return sources;
  }

  async createKnowledgeBase(input: {
    folderNodeId: string;
    name?: string | null;
    index?: string | null;
  }) {
    const response = await this.gql<{
      createKnowledgeBase: WorkspaceKnowledgeBase;
    }>(createKnowledgeBaseMutation, {
      workspaceId: this.workspaceId,
      ...input,
    });
    this.upsertKnowledgeBase(response.createKnowledgeBase);
    return response.createKnowledgeBase;
  }

  async renameKnowledgeBase(id: string, name: string) {
    const response = await this.gql<{
      renameKnowledgeBase: WorkspaceKnowledgeBase;
    }>(renameKnowledgeBaseMutation, { id, name });
    this.upsertKnowledgeBase(response.renameKnowledgeBase);
    return response.renameKnowledgeBase;
  }

  async trashKnowledgeBase(
    id: string,
    restoreMeta?: {
      lastParentFolderNodeId?: string | null;
      lastIndex?: string | null;
    }
  ) {
    const response = await this.gql<{
      trashKnowledgeBase: WorkspaceKnowledgeBase;
    }>(trashKnowledgeBaseMutation, {
      id,
      lastParentFolderNodeId: restoreMeta?.lastParentFolderNodeId,
      lastIndex: restoreMeta?.lastIndex,
    });
    this.knowledgeBases$.next(
      this.knowledgeBases$.value.filter(
        knowledgeBase => knowledgeBase.id !== response.trashKnowledgeBase.id
      )
    );
    return response.trashKnowledgeBase;
  }

  async restoreKnowledgeBase(id: string) {
    const response = await this.gql<{
      restoreKnowledgeBase: WorkspaceKnowledgeBase;
    }>(restoreKnowledgeBaseMutation, { id });
    this.upsertKnowledgeBase(response.restoreKnowledgeBase);
    return response.restoreKnowledgeBase;
  }

  async updateSettings(
    id: string,
    input: {
      includeSubfolders?: boolean;
      selectionCreateDocMinLines?: number;
    }
  ) {
    const response = await this.gql<{
      updateKnowledgeBaseSettings: WorkspaceKnowledgeBase;
    }>(updateKnowledgeBaseSettingsMutation, {
      id,
      ...input,
    });
    this.upsertKnowledgeBase(response.updateKnowledgeBaseSettings);
    return response.updateKnowledgeBaseSettings;
  }

  async moveKnowledgeBase(
    id: string,
    input: {
      folderNodeId: string;
      index?: string | null;
    }
  ) {
    const response = await this.gql<{
      moveKnowledgeBase: WorkspaceKnowledgeBase;
    }>(moveKnowledgeBaseMutation, {
      id,
      folderNodeId: input.folderNodeId,
      index: input.index,
    });
    this.upsertKnowledgeBase(response.moveKnowledgeBase);
    return response.moveKnowledgeBase;
  }

  async syncSources(
    knowledgeBaseId: string,
    sources: KnowledgeBaseSourceInput[]
  ) {
    const response = await this.gql<{
      syncKnowledgeBaseSources: WorkspaceKnowledgeBaseSource[];
    }>(syncKnowledgeBaseSourcesMutation, { knowledgeBaseId, sources });
    this.setSources(knowledgeBaseId, response.syncKnowledgeBaseSources);
    return response.syncKnowledgeBaseSources;
  }

  async updateSourceOverrides(
    knowledgeBaseId: string,
    overrides: {
      sourceType: KnowledgeBaseSourceType;
      sourceId: string;
      manualOverride?: KnowledgeBaseSourceOverride | null;
    }[]
  ) {
    const response = await this.gql<{
      updateKnowledgeBaseSourceOverrides: WorkspaceKnowledgeBaseSource[];
    }>(updateKnowledgeBaseSourceOverridesMutation, {
      knowledgeBaseId,
      overrides,
    });
    this.setSources(
      knowledgeBaseId,
      response.updateKnowledgeBaseSourceOverrides
    );
    return response.updateKnowledgeBaseSourceOverrides;
  }

  async reindex(knowledgeBaseId: string) {
    const response = await this.gql<{
      reindexKnowledgeBase: WorkspaceKnowledgeBaseSource[];
    }>(reindexKnowledgeBaseMutation, { knowledgeBaseId });
    this.setSources(knowledgeBaseId, response.reindexKnowledgeBase);
    return response.reindexKnowledgeBase;
  }

  async ask(knowledgeBaseId: string, question: string) {
    const response = await this.gql<{
      askKnowledgeBase: KnowledgeBaseAskResult;
    }>(askKnowledgeBaseMutation, {
      knowledgeBaseId,
      question,
    });
    return response.askKnowledgeBase;
  }

  async createSelectionDocDraft(knowledgeBaseId: string, selection: string) {
    const response = await this.gql<{
      createDocFromKnowledgeBaseSelection: KnowledgeBaseSelectionDocDraft;
    }>(createDocFromKnowledgeBaseSelectionMutation, {
      knowledgeBaseId,
      selection,
    });
    return response.createDocFromKnowledgeBaseSelection;
  }

  private upsertKnowledgeBase(knowledgeBase: WorkspaceKnowledgeBase) {
    const knowledgeBases = this.knowledgeBases$.value.filter(
      item => item.id !== knowledgeBase.id
    );
    this.knowledgeBases$.next([knowledgeBase, ...knowledgeBases]);
  }

  private setSources(
    knowledgeBaseId: string,
    sources: WorkspaceKnowledgeBaseSource[]
  ) {
    this.sources$.next({
      ...this.sources$.value,
      [knowledgeBaseId]: sources,
    });
  }
}
