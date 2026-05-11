import type { GraphQLQuery } from '@affine/graphql';
import { LiveData, Service } from '@toeverything/infra';

import {
  DefaultServerService,
  FetchService,
  GraphQLService,
  WorkspaceServerService,
} from '../../cloud';
import type { WorkspaceService } from '../../workspace';

export type ContainerStatus = 'active' | 'trashed';
export type ContainerFileKind = 'image' | 'text' | 'pdf' | 'directory';
export type ContainerFileStatus = 'pending' | 'active' | 'deleted';

export interface WorkspaceContainer {
  id: string;
  workspaceId: string;
  name: string;
  status: ContainerStatus;
  lastParentFolderNodeId?: string | null;
  lastIndex?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface WorkspaceContainerFile {
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
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

interface ContainerFileUploadInit {
  method: 'GRAPHQL' | 'PRESIGNED' | 'MULTIPART';
  file: WorkspaceContainerFile;
  uploadUrl?: string | null;
  headers?: Record<string, string> | null;
  uploadId?: string | null;
  partSize?: number | null;
  uploadedParts?: { partNumber: number; etag: string }[] | null;
}

interface ContainerFileUploadPart {
  uploadUrl: string;
  headers?: Record<string, string> | null;
}

const containerFields = `
  id
  workspaceId
  name
  status
  lastParentFolderNodeId
  lastIndex
  createdAt
  updatedAt
  deletedAt
`;

const fileFields = `
  id
  workspaceId
  containerId
  blobKey
  name
  kind
  mime
  size
  revision
  status
  createdAt
  updatedAt
  deletedAt
`;

const containerQuery = {
  id: 'container',
  op: 'container',
  query: `query container($id: String!) {
    container(id: $id) {
      ${containerFields}
    }
  }`,
} satisfies GraphQLQuery;

const workspaceContainersQuery = {
  id: 'workspaceContainers',
  op: 'workspace',
  query: `query workspaceContainers($workspaceId: String!, $status: WorkspaceContainerStatus) {
    workspace(id: $workspaceId) {
      id
      containers(status: $status) {
        ${containerFields}
      }
    }
  }`,
} satisfies GraphQLQuery;

const containerFilesQuery = {
  id: 'containerFiles',
  op: 'containerFiles',
  query: `query containerFiles($containerId: String!) {
    containerFiles(containerId: $containerId) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const createContainerMutation = {
  id: 'createContainer',
  op: 'createContainer',
  query: `mutation createContainer(
    $workspaceId: String!
    $name: String!
    $parentFolderNodeId: String
    $index: String
  ) {
    createContainer(
      workspaceId: $workspaceId
      name: $name
      parentFolderNodeId: $parentFolderNodeId
      index: $index
    ) {
      ${containerFields}
    }
  }`,
} satisfies GraphQLQuery;

const renameContainerMutation = {
  id: 'renameContainer',
  op: 'renameContainer',
  query: `mutation renameContainer($id: String!, $name: String!) {
    renameContainer(id: $id, name: $name) {
      ${containerFields}
    }
  }`,
} satisfies GraphQLQuery;

const trashContainerMutation = {
  id: 'trashContainer',
  op: 'trashContainer',
  query: `mutation trashContainer(
    $id: String!
    $lastParentFolderNodeId: String
    $lastIndex: String
  ) {
    trashContainer(
      id: $id
      lastParentFolderNodeId: $lastParentFolderNodeId
      lastIndex: $lastIndex
    ) {
      ${containerFields}
    }
  }`,
} satisfies GraphQLQuery;

const restoreContainerMutation = {
  id: 'restoreContainer',
  op: 'restoreContainer',
  query: `mutation restoreContainer($id: String!) {
    restoreContainer(id: $id) {
      ${containerFields}
    }
  }`,
} satisfies GraphQLQuery;

const uploadInitializedContainerFileMutation = {
  id: 'uploadInitializedContainerFile',
  op: 'uploadInitializedContainerFile',
  file: true,
  query: `mutation uploadInitializedContainerFile(
    $fileId: String!
    $file: Upload!
  ) {
    uploadInitializedContainerFile(fileId: $fileId, file: $file) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const createContainerTextFileMutation = {
  id: 'createContainerTextFile',
  op: 'createContainerTextFile',
  query: `mutation createContainerTextFile(
    $containerId: String!
    $name: String!
    $content: String
  ) {
    createContainerTextFile(
      containerId: $containerId
      name: $name
      content: $content
    ) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const createContainerDirectoryMutation = {
  id: 'createContainerDirectory',
  op: 'createContainerDirectory',
  query: `mutation createContainerDirectory(
    $containerId: String!
    $name: String!
  ) {
    createContainerDirectory(containerId: $containerId, name: $name) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const initContainerFileUploadMutation = {
  id: 'initContainerFileUpload',
  op: 'initContainerFileUpload',
  query: `mutation initContainerFileUpload(
    $containerId: String!
    $name: String!
    $size: Int!
    $mime: String!
  ) {
    initContainerFileUpload(
      containerId: $containerId
      name: $name
      size: $size
      mime: $mime
    ) {
      method
      file {
        ${fileFields}
      }
      uploadUrl
      headers
      uploadId
      partSize
      uploadedParts {
        partNumber
        etag
      }
    }
  }`,
} satisfies GraphQLQuery;

const containerFileUploadPartUrlMutation = {
  id: 'containerFileUploadPartUrl',
  op: 'containerFileUploadPartUrl',
  query: `mutation containerFileUploadPartUrl(
    $fileId: String!
    $uploadId: String!
    $partNumber: Int!
  ) {
    containerFileUploadPartUrl(
      fileId: $fileId
      uploadId: $uploadId
      partNumber: $partNumber
    ) {
      uploadUrl
      headers
    }
  }`,
} satisfies GraphQLQuery;

const completeContainerFileUploadMutation = {
  id: 'completeContainerFileUpload',
  op: 'completeContainerFileUpload',
  query: `mutation completeContainerFileUpload(
    $fileId: String!
    $uploadId: String
    $parts: [ContainerUploadedPartInput!]
  ) {
    completeContainerFileUpload(
      fileId: $fileId
      uploadId: $uploadId
      parts: $parts
    ) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const renameContainerFileMutation = {
  id: 'renameContainerFile',
  op: 'renameContainerFile',
  query: `mutation renameContainerFile($fileId: String!, $name: String!) {
    renameContainerFile(fileId: $fileId, name: $name) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const deleteContainerFileMutation = {
  id: 'deleteContainerFile',
  op: 'deleteContainerFile',
  query: `mutation deleteContainerFile($fileId: String!) {
    deleteContainerFile(fileId: $fileId) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

const updateContainerTextFileMutation = {
  id: 'updateContainerTextFile',
  op: 'updateContainerTextFile',
  query: `mutation updateContainerTextFile(
    $fileId: String!
    $baseRevision: Int!
    $content: String!
  ) {
    updateContainerTextFile(
      fileId: $fileId
      baseRevision: $baseRevision
      content: $content
    ) {
      ${fileFields}
    }
  }`,
} satisfies GraphQLQuery;

export class ContainerService extends Service {
  readonly containers$ = new LiveData<WorkspaceContainer[]>([]);
  readonly containerFiles$ = new LiveData<
    Record<string, WorkspaceContainerFile[]>
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

  private get fetchService() {
    return this.server.scope.get(FetchService);
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

  container$(id: string) {
    return this.containers$.selector(containers =>
      containers.find(container => container.id === id)
    );
  }

  files$(containerId: string) {
    return this.containerFiles$.selector(files => files[containerId] ?? []);
  }

  async revalidate(status: ContainerStatus = 'active') {
    const response = await this.gql<{
      workspace?: { containers?: WorkspaceContainer[] };
    }>(workspaceContainersQuery, { workspaceId: this.workspaceId, status });
    const containers = response.workspace?.containers ?? [];
    if (status === 'active') {
      this.containers$.next(containers);
    }
    return containers;
  }

  async loadContainer(id: string) {
    const response = await this.gql<{ container?: WorkspaceContainer }>(
      containerQuery,
      { id }
    );
    const container = response.container;
    if (!container) {
      return null;
    }
    this.upsertContainer(container);
    return container;
  }

  async listFiles(containerId: string) {
    const response = await this.gql<{
      containerFiles?: WorkspaceContainerFile[];
    }>(containerFilesQuery, { containerId });
    const files = response.containerFiles ?? [];
    this.containerFiles$.next({
      ...this.containerFiles$.value,
      [containerId]: files,
    });
    return files;
  }

  async createContainer(input: {
    name: string;
    parentFolderNodeId?: string | null;
    index?: string | null;
  }) {
    const response = await this.gql<{ createContainer: WorkspaceContainer }>(
      createContainerMutation,
      {
        workspaceId: this.workspaceId,
        ...input,
      }
    );
    this.upsertContainer(response.createContainer);
    return response.createContainer;
  }

  async renameContainer(id: string, name: string) {
    const response = await this.gql<{ renameContainer: WorkspaceContainer }>(
      renameContainerMutation,
      { id, name }
    );
    this.upsertContainer(response.renameContainer);
    return response.renameContainer;
  }

  async trashContainer(
    id: string,
    restoreMeta?: {
      lastParentFolderNodeId?: string | null;
      lastIndex?: string | null;
    }
  ) {
    const response = await this.gql<{ trashContainer: WorkspaceContainer }>(
      trashContainerMutation,
      {
        id,
        lastParentFolderNodeId: restoreMeta?.lastParentFolderNodeId,
        lastIndex: restoreMeta?.lastIndex,
      }
    );
    this.containers$.next(
      this.containers$.value.filter(
        container => container.id !== response.trashContainer.id
      )
    );
    return response.trashContainer;
  }

  async restoreContainer(id: string) {
    const response = await this.gql<{ restoreContainer: WorkspaceContainer }>(
      restoreContainerMutation,
      { id }
    );
    this.upsertContainer(response.restoreContainer);
    return response.restoreContainer;
  }

  async createTextFile(containerId: string, name: string, content = '') {
    const response = await this.gql<{
      createContainerTextFile: WorkspaceContainerFile;
    }>(createContainerTextFileMutation, {
      containerId,
      name,
      content,
    });
    this.upsertFile(containerId, response.createContainerTextFile);
    return response.createContainerTextFile;
  }

  async createDirectory(containerId: string, name: string) {
    const response = await this.gql<{
      createContainerDirectory: WorkspaceContainerFile;
    }>(createContainerDirectoryMutation, {
      containerId,
      name,
    });
    this.upsertFile(containerId, response.createContainerDirectory);
    return response.createContainerDirectory;
  }

  async uploadFile(containerId: string, file: File, name = file.name) {
    const mime = file.type || 'application/octet-stream';
    const initResponse = await this.gql<{
      initContainerFileUpload: ContainerFileUploadInit;
    }>(initContainerFileUploadMutation, {
      containerId,
      name,
      size: file.size,
      mime,
    });
    const init = initResponse.initContainerFileUpload;

    if (init.method === 'PRESIGNED' && init.uploadUrl) {
      await this.putToUploadUrl(init.uploadUrl, file, init.headers);
      return this.completeUpload(containerId, init.file.id);
    }

    if (init.method === 'MULTIPART' && init.uploadId && init.partSize) {
      const parts = await this.uploadMultipartFile(file, init);
      return this.completeUpload(containerId, init.file.id, {
        uploadId: init.uploadId,
        parts,
      });
    }

    const response = await this.gql<{
      uploadInitializedContainerFile: WorkspaceContainerFile;
    }>(
      uploadInitializedContainerFileMutation,
      { fileId: init.file.id, file },
      {
        timeout: 0,
      }
    );
    this.upsertFile(containerId, response.uploadInitializedContainerFile);
    return response.uploadInitializedContainerFile;
  }

  async renameFile(file: WorkspaceContainerFile, name: string) {
    const response = await this.gql<{
      renameContainerFile: WorkspaceContainerFile;
    }>(renameContainerFileMutation, { fileId: file.id, name });
    this.upsertFile(file.containerId, response.renameContainerFile);
    return response.renameContainerFile;
  }

  async deleteFile(file: WorkspaceContainerFile) {
    const response = await this.gql<{
      deleteContainerFile: WorkspaceContainerFile;
    }>(deleteContainerFileMutation, { fileId: file.id });
    const deletedName = response.deleteContainerFile.name.toLowerCase();
    this.containerFiles$.next({
      ...this.containerFiles$.value,
      [file.containerId]: (this.containerFiles$.value[file.containerId] ?? [])
        .filter(item => {
          if (response.deleteContainerFile.kind === 'directory') {
            return (
              item.id !== file.id &&
              !item.name.toLowerCase().startsWith(deletedName)
            );
          }
          return item.id !== file.id;
        }),
    });
    return response.deleteContainerFile;
  }

  async updateTextFile(
    file: WorkspaceContainerFile,
    content: string,
    baseRevision: number
  ) {
    const response = await this.gql<{
      updateContainerTextFile: WorkspaceContainerFile;
    }>(updateContainerTextFileMutation, {
      fileId: file.id,
      baseRevision,
      content,
    });
    this.upsertFile(file.containerId, response.updateContainerTextFile);
    return response.updateContainerTextFile;
  }

  contentUrl(file: WorkspaceContainerFile) {
    return `/api/workspaces/${encodeURIComponent(
      file.workspaceId
    )}/containers/${encodeURIComponent(
      file.containerId
    )}/files/${encodeURIComponent(file.id)}/content`;
  }

  async fetchText(file: WorkspaceContainerFile) {
    const response = await this.fetchService.fetch(this.contentUrl(file), {
      cache: 'no-store',
      timeout: 0,
    });
    return response.text();
  }

  private upsertContainer(container: WorkspaceContainer) {
    const containers = this.containers$.value.filter(
      item => item.id !== container.id
    );
    this.containers$.next([container, ...containers]);
  }

  private upsertFile(containerId: string, file: WorkspaceContainerFile) {
    const files = (this.containerFiles$.value[containerId] ?? []).filter(
      item => item.id !== file.id
    );
    this.containerFiles$.next({
      ...this.containerFiles$.value,
      [containerId]: [file, ...files],
    });
  }

  private async completeUpload(
    containerId: string,
    fileId: string,
    input?: {
      uploadId?: string;
      parts?: { partNumber: number; etag: string }[];
    }
  ) {
    const response = await this.gql<{
      completeContainerFileUpload: WorkspaceContainerFile;
    }>(completeContainerFileUploadMutation, {
      fileId,
      uploadId: input?.uploadId,
      parts: input?.parts,
    });
    this.upsertFile(containerId, response.completeContainerFileUpload);
    return response.completeContainerFileUpload;
  }

  private async uploadMultipartFile(
    file: File,
    init: ContainerFileUploadInit
  ) {
    const uploadId = init.uploadId;
    const partSize = init.partSize;
    if (!uploadId || !partSize) {
      throw new Error('Multipart upload session is incomplete.');
    }

    const uploadedParts = new Map(
      (init.uploadedParts ?? []).map(part => [part.partNumber, part.etag])
    );
    const parts: { partNumber: number; etag: string }[] = [];
    const partCount = Math.ceil(file.size / partSize);

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const existingEtag = uploadedParts.get(partNumber);
      if (existingEtag) {
        parts.push({ partNumber, etag: existingEtag });
        continue;
      }

      const part = await this.gql<{
        containerFileUploadPartUrl: ContainerFileUploadPart;
      }>(containerFileUploadPartUrlMutation, {
        fileId: init.file.id,
        uploadId,
        partNumber,
      });
      const start = (partNumber - 1) * partSize;
      const end = Math.min(partNumber * partSize, file.size);
      const response = await this.putToUploadUrl(
        part.containerFileUploadPartUrl.uploadUrl,
        file.slice(start, end),
        part.containerFileUploadPartUrl.headers
      );
      const etag = response.headers.get('etag');
      if (!etag) {
        throw new Error('Multipart upload part did not return an ETag.');
      }
      parts.push({ partNumber, etag });
    }

    return parts;
  }

  private async putToUploadUrl(
    url: string,
    body: Blob,
    headers?: Record<string, string> | null
  ) {
    const response = await globalThis.fetch(url, {
      method: 'PUT',
      headers: headers ?? undefined,
      body,
    });
    if (!response.ok) {
      throw new Error(`Upload failed with HTTP ${response.status}.`);
    }
    return response;
  }
}
