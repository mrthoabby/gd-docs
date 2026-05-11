import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';

import type { FileUpload } from '../../../base';
import {
  BadRequest,
  BlobInvalid,
  BlobNotFound,
  BlobQuotaExceeded,
  NotFound,
  readBuffer,
  readableToBuffer,
  StorageQuotaExceeded,
  ValidationError,
  VersionRejected,
} from '../../../base';
import type {
  ContainerFileKind,
  WorkspaceContainerFileRecord,
  WorkspaceContainerRecord,
} from '../../../models';
import { Models } from '../../../models';
import type { CurrentUser } from '../../auth';
import { AccessController, WorkspacePolicyService } from '../../permission';
import { QuotaService } from '../../quota';
import { WorkspaceBlobStorage } from '../../storage';
import {
  MULTIPART_PART_SIZE,
  MULTIPART_THRESHOLD,
} from '../../storage/constants';

export type ContainerFileUploadMethod = 'GRAPHQL' | 'PRESIGNED' | 'MULTIPART';

export type ContainerFileUploadInit = {
  method: ContainerFileUploadMethod;
  file: WorkspaceContainerFileRecord;
  blobKey: string;
  alreadyUploaded?: boolean;
  uploadUrl?: string;
  headers?: Record<string, string>;
  expiresAt?: Date;
  uploadId?: string;
  partSize?: number;
  uploadedParts?: { partNumber: number; etag: string }[];
};

export type ContainerFileUploadPart = {
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresAt?: Date;
};

export const CONTAINER_TEXT_MAX_SIZE = 5 * 1024 * 1024;
const CONTAINER_PATH_MAX_LENGTH = 240;
const CONTAINER_PATH_SEGMENT_MAX_LENGTH = 120;
const DIRECTORY_MIME = 'inode/directory';

const EXT_TO_KIND = new Map<string, ContainerFileKind>([
  ['.png', 'image'],
  ['.jpg', 'image'],
  ['.jpeg', 'image'],
  ['.webp', 'image'],
  ['.gif', 'image'],
  ['.md', 'text'],
  ['.txt', 'text'],
  ['.yml', 'text'],
  ['.yaml', 'text'],
  ['.nb', 'text'],
  ['.pdf', 'pdf'],
]);

const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const IMAGE_EXTENSION_MIME = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);
const TEXT_MIMES = new Set([
  '',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/yaml',
  'text/x-yaml',
  'application/yaml',
  'application/x-yaml',
  'application/octet-stream',
]);
const PDF_MIMES = new Set(['', 'application/pdf', 'application/octet-stream']);

function normalizeContainerPath(name: string, directory = false) {
  const path = (name || '')
    .replace(/\\/g, '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const segments = path
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    throw new ValidationError(
      { errors: 'Invalid container path' },
      directory ? 'Directory name is required.' : 'File name is required.'
    );
  }

  for (const segment of segments) {
    if (
      segment === '.' ||
      segment === '..' ||
      segment.length > CONTAINER_PATH_SEGMENT_MAX_LENGTH
    ) {
      throw new ValidationError(
        { errors: 'Invalid container path segment' },
        'Container path segment is invalid.'
      );
    }
  }

  const normalized = `${segments.join('/')}${directory ? '/' : ''}`;
  if (normalized.length > CONTAINER_PATH_MAX_LENGTH) {
    throw new ValidationError(
      { errors: 'Container path is too long' },
      `Container path must be ${CONTAINER_PATH_MAX_LENGTH} characters or fewer.`
    );
  }

  return normalized;
}

function normalizeFileName(name: string) {
  return normalizeContainerPath(name);
}

function normalizeDirectoryName(name: string) {
  return normalizeContainerPath(name, true);
}

function normalizeContainerName(name: string) {
  const normalized = name.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!normalized) {
    throw new ValidationError(
      { errors: 'Invalid container name' },
      'Container name is required.'
    );
  }
  if (normalized.length > 120) {
    throw new ValidationError(
      { errors: 'Container name is too long' },
      'Container name must be 120 characters or fewer.'
    );
  }
  return normalized;
}

function extensionOf(name: string) {
  const leaf = pathLeaf(name);
  const dot = leaf.lastIndexOf('.');
  return dot >= 0 ? leaf.slice(dot).toLowerCase() : '';
}

function pathLeaf(name: string) {
  const clean = name.endsWith('/') ? name.slice(0, -1) : name;
  const slash = clean.lastIndexOf('/');
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

function mimeFor(kind: ContainerFileKind, name: string, mime: string) {
  if (kind === 'directory') return DIRECTORY_MIME;
  if (mime && mime !== 'application/octet-stream') {
    return mime;
  }
  const ext = extensionOf(name);
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'text') {
    if (ext === '.md') return 'text/markdown';
    if (ext === '.yml' || ext === '.yaml') return 'application/x-yaml';
    return 'text/plain';
  }
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function classifyFile(name: string, rawMime: string) {
  const normalizedName = normalizeFileName(name);
  const ext = extensionOf(normalizedName);
  const kind = EXT_TO_KIND.get(ext);
  if (!kind) {
    throw new BlobInvalid('Unsupported container file type.');
  }

  const mime = (rawMime || '').split(';')[0].trim().toLowerCase();
  if (kind === 'image') {
    const expectedMime = IMAGE_EXTENSION_MIME.get(ext);
    if (!IMAGE_MIMES.has(mime) || mime !== expectedMime) {
      throw new BlobInvalid(
        'Image MIME type does not match the file extension.'
      );
    }
  }
  if (kind === 'text' && !TEXT_MIMES.has(mime)) {
    throw new BlobInvalid('Text MIME type does not match the file extension.');
  }
  if (kind === 'pdf' && !PDF_MIMES.has(mime)) {
    throw new BlobInvalid('PDF MIME type does not match the file extension.');
  }

  return {
    name: normalizedName,
    kind,
    mime: mimeFor(kind, normalizedName, mime),
  };
}

function safeBlobName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'file';
}

function isUtf8(buffer: Buffer) {
  return Buffer.from(buffer.toString('utf8'), 'utf8').equals(buffer);
}

function validateBuffer(kind: ContainerFileKind, buffer: Buffer) {
  if (kind === 'directory') {
    return;
  }

  if (kind === 'text') {
    if (buffer.length > CONTAINER_TEXT_MAX_SIZE) {
      throw new BlobQuotaExceeded('Text files must be 5 MiB or smaller.');
    }
    if (!isUtf8(buffer)) {
      throw new BlobInvalid('Text files must be valid UTF-8.');
    }
    return;
  }

  if (kind === 'pdf') {
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new BlobInvalid('Invalid PDF file.');
    }
    return;
  }

  const prefix = buffer.subarray(0, 12);
  const isPng = prefix.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  const isJpeg = prefix[0] === 0xff && prefix[1] === 0xd8;
  const isGif =
    prefix.subarray(0, 6).toString('ascii') === 'GIF87a' ||
    prefix.subarray(0, 6).toString('ascii') === 'GIF89a';
  const isWebp =
    prefix.subarray(0, 4).toString('ascii') === 'RIFF' &&
    prefix.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isPng && !isJpeg && !isGif && !isWebp) {
    throw new BlobInvalid('Invalid image file.');
  }
}

@Injectable()
export class ContainerService {
  constructor(
    private readonly ac: AccessController,
    private readonly policy: WorkspacePolicyService,
    private readonly quota: QuotaService,
    private readonly storage: WorkspaceBlobStorage,
    private readonly models: Models
  ) {}

  async createContainer(
    user: CurrentUser,
    input: {
      workspaceId: string;
      name: string;
      parentFolderNodeId?: string | null;
      index?: string | null;
    }
  ) {
    await this.assertCanWrite(user.id, input.workspaceId);
    return this.models.container.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name: normalizeContainerName(input.name),
      createdBy: user.id,
      lastParentFolderNodeId: input.parentFolderNodeId,
      lastIndex: input.index,
    });
  }

  async getContainer(user: CurrentUser, id: string) {
    const container = await this.models.container.get(id);
    if (!container) {
      throw new NotFound('Container not found.');
    }
    await this.assertCanRead(user.id, container.workspaceId);
    return container;
  }

  async listContainers(
    user: CurrentUser,
    workspaceId: string,
    status: 'active' | 'trashed' = 'active'
  ) {
    await this.assertCanRead(user.id, workspaceId);
    return this.models.container.list(workspaceId, status);
  }

  async renameContainer(user: CurrentUser, id: string, name: string) {
    const container = await this.requireContainer(id);
    await this.assertCanWrite(user.id, container.workspaceId);
    return this.models.container.rename(
      id,
      normalizeContainerName(name),
      user.id
    );
  }

  async trashContainer(
    user: CurrentUser,
    id: string,
    restoreMeta?: {
      lastParentFolderNodeId?: string | null;
      lastIndex?: string | null;
    }
  ) {
    const container = await this.requireContainer(id);
    await this.assertCanDelete(user.id, container.workspaceId);
    return this.models.container.trash(id, user.id, restoreMeta);
  }

  async restoreContainer(user: CurrentUser, id: string) {
    const container = await this.models.container.get(id);
    if (!container) {
      throw new NotFound('Container not found.');
    }
    await this.assertCanWrite(user.id, container.workspaceId);
    return this.models.container.restore(id, user.id);
  }

  async listFiles(user: CurrentUser, containerId: string) {
    const container = await this.requireContainer(containerId);
    await this.assertCanRead(user.id, container.workspaceId);
    return this.models.containerFile.list(containerId);
  }

  async createTextFile(
    user: CurrentUser,
    input: { containerId: string; name: string; content?: string }
  ) {
    const container = await this.requireContainer(input.containerId);
    await this.assertCanWrite(user.id, container.workspaceId);

    const classified = classifyFile(input.name, '');
    if (classified.kind !== 'text') {
      throw new BlobInvalid('Only text files can be created inline.');
    }
    await this.assertPathAvailable(container.id, classified.name);

    const buffer = Buffer.from(input.content ?? '', 'utf8');
    validateBuffer('text', buffer);
    const checkExceeded =
      await this.quota.getWorkspaceQuotaCalculator(container.workspaceId);
    const result = checkExceeded(buffer.length);
    if (result?.blobQuotaExceeded) throw new BlobQuotaExceeded();
    if (result?.storageQuotaExceeded) throw new StorageQuotaExceeded();

    const id = randomUUID();
    const blobKey = this.blobKey(container.id, id, 1, classified.name);
    const file = await this.models.containerFile.create({
      id,
      workspaceId: container.workspaceId,
      containerId: container.id,
      blobKey,
      name: classified.name,
      kind: 'text',
      mime: classified.mime,
      size: buffer.length,
      createdBy: user.id,
    });

    try {
      await this.storage.put(container.workspaceId, blobKey, buffer, {
        contentType: classified.mime,
        contentLength: buffer.length,
      });
    } catch (error) {
      await this.models.containerFile.delete(file.id, user.id).catch(() => {});
      throw error;
    }

    return this.models.containerFile.activate(file.id);
  }

  async createDirectory(
    user: CurrentUser,
    input: { containerId: string; name: string }
  ) {
    const container = await this.requireContainer(input.containerId);
    await this.assertCanWrite(user.id, container.workspaceId);

    const name = normalizeDirectoryName(input.name);
    await this.assertPathAvailable(container.id, name);
    const id = randomUUID();

    return this.models.containerFile.create({
      id,
      workspaceId: container.workspaceId,
      containerId: container.id,
      blobKey: this.directoryBlobKey(container.id, id),
      name,
      kind: 'directory',
      mime: DIRECTORY_MIME,
      size: 0,
      status: 'active',
      createdBy: user.id,
    });
  }

  async uploadContainerFile(
    user: CurrentUser,
    containerId: string,
    upload: FileUpload
  ) {
    const container = await this.requireContainer(containerId);
    await this.assertCanWrite(user.id, container.workspaceId);

    const classified = classifyFile(upload.filename, upload.mimetype);
    await this.assertPathAvailable(containerId, classified.name);
    const checkExceeded =
      await this.quota.getWorkspaceQuotaCalculator(container.workspaceId);
    const buffer = await readBuffer(upload.createReadStream(), recvSize => {
      if (classified.kind === 'text' && recvSize > CONTAINER_TEXT_MAX_SIZE) {
        return { blobQuotaExceeded: true, storageQuotaExceeded: false };
      }
      return checkExceeded(recvSize);
    });
    validateBuffer(classified.kind, buffer);

    const id = randomUUID();
    const blobKey = this.blobKey(container.id, id, 1, classified.name);
    const file = await this.models.containerFile.create({
      id,
      workspaceId: container.workspaceId,
      containerId: container.id,
      blobKey,
      name: classified.name,
      kind: classified.kind,
      mime: classified.mime,
      size: buffer.length,
      createdBy: user.id,
    });

    try {
      await this.storage.put(container.workspaceId, blobKey, buffer, {
        contentType: classified.mime,
        contentLength: buffer.length,
      });
    } catch (error) {
      await this.models.containerFile.delete(file.id, user.id).catch(() => {});
      throw error;
    }

    return this.models.containerFile.activate(file.id);
  }

  async initUpload(
    user: CurrentUser,
    input: {
      containerId: string;
      name: string;
      size: number;
      mime: string;
    }
  ): Promise<ContainerFileUploadInit> {
    const container = await this.requireContainer(input.containerId);
    await this.assertCanWrite(user.id, container.workspaceId);
    const classified = classifyFile(input.name, input.mime);
    await this.assertPathAvailable(input.containerId, classified.name);
    this.assertUploadSize(classified.kind, input.size);

    const checkExceeded =
      await this.quota.getWorkspaceQuotaCalculator(container.workspaceId);
    const result = checkExceeded(input.size);
    if (result?.blobQuotaExceeded) throw new BlobQuotaExceeded();
    if (result?.storageQuotaExceeded) throw new StorageQuotaExceeded();

    const id = randomUUID();
    const blobKey = this.blobKey(container.id, id, 1, classified.name);
    const file = await this.models.containerFile.create({
      id,
      workspaceId: container.workspaceId,
      containerId: container.id,
      blobKey,
      name: classified.name,
      kind: classified.kind,
      mime: classified.mime,
      size: input.size,
      createdBy: user.id,
    });

    await this.models.blob.upsert({
      workspaceId: container.workspaceId,
      key: blobKey,
      mime: classified.mime,
      size: input.size,
      status: 'pending',
      uploadId: null,
    });

    const metadata = {
      contentType: classified.mime,
      contentLength: input.size,
    };
    let uploadIdForRecord: string | null = null;
    let init: Omit<ContainerFileUploadInit, 'file' | 'blobKey'> | null = null;

    if (input.size >= MULTIPART_THRESHOLD) {
      const multipart = await this.storage.createMultipartUpload(
        container.workspaceId,
        blobKey,
        metadata
      );
      if (multipart) {
        uploadIdForRecord = multipart.uploadId;
        init = {
          method: 'MULTIPART',
          uploadId: multipart.uploadId,
          partSize: MULTIPART_PART_SIZE,
          expiresAt: multipart.expiresAt,
          uploadedParts: [],
        };
      }
    }

    if (!init) {
      const presigned = await this.storage.presignPut(
        container.workspaceId,
        blobKey,
        metadata
      );
      if (presigned) {
        init = {
          method: 'PRESIGNED',
          uploadUrl: presigned.url,
          headers: presigned.headers,
          expiresAt: presigned.expiresAt,
        };
      }
    }

    if (uploadIdForRecord) {
      await this.models.blob.upsert({
        workspaceId: container.workspaceId,
        key: blobKey,
        mime: classified.mime,
        size: input.size,
        status: 'pending',
        uploadId: uploadIdForRecord,
      });
    }

    return {
      ...(init ?? { method: 'GRAPHQL' }),
      file,
      blobKey,
    };
  }

  async completeUpload(
    user: CurrentUser,
    input: {
      fileId: string;
      uploadId?: string;
      parts?: { partNumber: number; etag: string }[];
    }
  ) {
    const file = await this.requireFile(input.fileId, 'pending');
    await this.assertCanWrite(user.id, file.workspaceId);

    if (input.uploadId || input.parts?.length) {
      if (!input.uploadId || !input.parts?.length) {
        throw new BlobInvalid('Multipart upload requires uploadId and parts.');
      }
      const completed = await this.storage.completeMultipartUpload(
        file.workspaceId,
        file.blobKey,
        input.uploadId,
        input.parts
      );
      if (!completed) {
        throw new BlobInvalid('Multipart upload is not supported.');
      }
    }

    const result = await this.storage.complete(file.workspaceId, file.blobKey, {
      size: file.size,
      mime: file.mime,
      verifyChecksum: false,
    });
    if (!result.ok) {
      throw new BlobInvalid(`Blob ${result.reason.replaceAll('_', ' ')}.`);
    }

    try {
      await this.validateStoredFile(file);
      return await this.models.containerFile.activate(file.id);
    } catch (error) {
      await this.storage
        .delete(file.workspaceId, file.blobKey, false)
        .catch(() => {});
      await this.models.containerFile.delete(file.id, user.id).catch(() => {});
      throw error;
    }
  }

  async uploadInitializedFile(
    user: CurrentUser,
    fileId: string,
    upload: FileUpload
  ) {
    const file = await this.requireFile(fileId, 'pending');
    await this.assertCanWrite(user.id, file.workspaceId);

    const classified = classifyFile(upload.filename, upload.mimetype);
    if (
      (file.name !== classified.name &&
        pathLeaf(file.name) !== classified.name) ||
      classified.kind !== file.kind
    ) {
      throw new BlobInvalid('Uploaded file does not match upload session.');
    }

    const checkExceeded =
      await this.quota.getWorkspaceQuotaCalculator(file.workspaceId);
    try {
      const buffer = await readBuffer(upload.createReadStream(), recvSize => {
        if (classified.kind === 'text' && recvSize > CONTAINER_TEXT_MAX_SIZE) {
          return { blobQuotaExceeded: true, storageQuotaExceeded: false };
        }
        return checkExceeded(Math.max(recvSize - file.size, 0));
      });
      if (buffer.length !== file.size) {
        throw new BlobInvalid(
          'Uploaded file size does not match upload session.'
        );
      }
      validateBuffer(file.kind, buffer);

      await this.storage.put(file.workspaceId, file.blobKey, buffer, {
        contentType: file.mime,
        contentLength: buffer.length,
      });
    } catch (error) {
      await this.models.containerFile.delete(file.id, user.id).catch(() => {});
      await this.models.blob
        .delete(file.workspaceId, file.blobKey)
        .catch(() => {});
      throw error;
    }

    return this.models.containerFile.activate(file.id);
  }

  async getUploadPart(
    user: CurrentUser,
    input: {
      fileId: string;
      uploadId: string;
      partNumber: number;
    }
  ): Promise<ContainerFileUploadPart> {
    const file = await this.requireFile(input.fileId, 'pending');
    await this.assertCanWrite(user.id, file.workspaceId);

    if (!Number.isSafeInteger(input.partNumber) || input.partNumber < 1) {
      throw new BlobInvalid('Invalid multipart part number.');
    }

    const record = await this.models.blob.get(file.workspaceId, file.blobKey);
    if (!record || record.uploadId !== input.uploadId) {
      throw new BlobInvalid('Multipart upload session not found.');
    }

    const presigned = await this.storage.presignUploadPart(
      file.workspaceId,
      file.blobKey,
      input.uploadId,
      input.partNumber
    );
    if (!presigned) {
      throw new BlobInvalid('Multipart upload is not supported.');
    }

    return {
      uploadUrl: presigned.url,
      headers: presigned.headers,
      expiresAt: presigned.expiresAt,
    };
  }

  async renameFile(user: CurrentUser, fileId: string, name: string) {
    const file = await this.requireFile(fileId, 'active');
    await this.assertCanWrite(user.id, file.workspaceId);
    if (file.kind === 'directory') {
      const nextName = normalizeDirectoryName(name);
      if (nextName === file.name) {
        return file;
      }
      if (nextName.startsWith(file.name)) {
        throw new BadRequest('A directory cannot be moved into itself.');
      }

      const descendants = await this.models.containerFile.listByNamePrefix(
        file.containerId,
        file.name
      );
      const excludedIds = new Set(descendants.map(record => record.id));
      await this.assertPathAvailable(file.containerId, nextName, excludedIds);
      const renamed = await this.models.containerFile.renameMany(
        descendants.map(record => ({
          id: record.id,
          name: `${nextName}${record.name.slice(file.name.length)}`,
        })),
        user.id
      );
      return renamed.find(record => record.id === file.id) ?? file;
    }

    const classified = classifyFile(name, file.mime);
    if (classified.kind !== file.kind) {
      throw new BlobInvalid('Renaming cannot change the file type.');
    }
    await this.assertPathAvailable(
      file.containerId,
      classified.name,
      new Set([file.id])
    );
    return this.models.containerFile.rename(file.id, classified.name, user.id);
  }

  async deleteFile(user: CurrentUser, fileId: string) {
    const file = await this.requireFile(fileId, 'active');
    await this.assertCanDelete(user.id, file.workspaceId);
    if (file.kind === 'directory') {
      const descendants = await this.models.containerFile.listByNamePrefix(
        file.containerId,
        file.name
      );
      for (const record of descendants) {
        if (record.kind !== 'directory') {
          await this.storage.delete(record.workspaceId, record.blobKey, false);
        }
      }
      const deleted = await this.models.containerFile.deleteMany(
        descendants.map(record => record.id),
        user.id
      );
      return deleted.find(record => record.id === file.id) ?? file;
    }
    await this.storage.delete(file.workspaceId, file.blobKey, false);
    return this.models.containerFile.delete(file.id, user.id);
  }

  async updateTextFile(
    user: CurrentUser,
    fileId: string,
    input: { content: string; baseRevision: number }
  ) {
    const file = await this.requireFile(fileId, 'active');
    await this.assertCanWrite(user.id, file.workspaceId);
    if (file.kind !== 'text') {
      throw new BlobInvalid('Only text files can be edited.');
    }
    if (file.revision !== input.baseRevision) {
      throw new VersionRejected(
        {
          version: String(input.baseRevision),
          serverVersion: String(file.revision),
        },
        'Container file has changed.'
      );
    }

    const buffer = Buffer.from(input.content, 'utf8');
    validateBuffer('text', buffer);
    const checkExceeded =
      await this.quota.getWorkspaceQuotaCalculator(file.workspaceId);
    const result = checkExceeded(Math.max(buffer.length - file.size, 0));
    if (result?.blobQuotaExceeded) throw new BlobQuotaExceeded();
    if (result?.storageQuotaExceeded) throw new StorageQuotaExceeded();

    const revision = file.revision + 1;
    const blobKey = this.blobKey(file.containerId, file.id, revision, file.name);
    await this.storage.put(file.workspaceId, blobKey, buffer, {
      contentType: file.mime || 'text/plain',
      contentLength: buffer.length,
    });
    await this.storage.delete(file.workspaceId, file.blobKey, false);

    return this.models.containerFile.updateText({
      id: file.id,
      blobKey,
      size: buffer.length,
      mime: file.mime || 'text/plain',
      revision,
      userId: user.id,
    });
  }

  async getFileContent(userId: string, workspaceId: string, fileId: string) {
    const file = await this.requireFile(fileId, 'active');
    if (file.workspaceId !== workspaceId) {
      throw new BlobNotFound({ spaceId: workspaceId, blobId: fileId });
    }
    if (file.kind === 'directory') {
      throw new BlobInvalid('Directories do not have downloadable content.');
    }
    const container = await this.requireContainer(file.containerId);
    await this.assertCanRead(userId, workspaceId);
    const object = await this.storage.get(workspaceId, file.blobKey, true);
    return { file, container, ...object };
  }

  private blobKey(
    containerId: string,
    fileId: string,
    revision: number,
    name: string
  ) {
    return `containers/${containerId}/${fileId}/r${revision}-${safeBlobName(
      name
    )}`;
  }

  private directoryBlobKey(containerId: string, fileId: string) {
    return `containers/${containerId}/${fileId}/directory`;
  }

  private assertUploadSize(kind: ContainerFileKind, size: number) {
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new BlobInvalid('Invalid file size.');
    }
    if (kind !== 'text' && size === 0) {
      throw new BlobInvalid('Invalid file size.');
    }
    if (kind === 'text' && size > CONTAINER_TEXT_MAX_SIZE) {
      throw new BlobQuotaExceeded('Text files must be 5 MiB or smaller.');
    }
  }

  private async assertPathAvailable(
    containerId: string,
    name: string,
    excludedIds = new Set<string>()
  ) {
    const files = await this.models.containerFile.list(containerId);
    const activeFiles = files.filter(file => !excludedIds.has(file.id));
    const normalizedName = name.toLowerCase();
    const existing = activeFiles.find(
      file => file.name.toLowerCase() === normalizedName
    );
    if (existing) {
      throw new BadRequest('A file with this name already exists.');
    }

    const filePath = name.endsWith('/') ? name.slice(0, -1) : name;
    const segments = filePath.split('/');
    const ancestors = new Set<string>();
    for (let index = 1; index < segments.length; index++) {
      ancestors.add(segments.slice(0, index).join('/').toLowerCase());
    }
    const blockedAncestor = activeFiles.find(
      file =>
        file.kind !== 'directory' && ancestors.has(file.name.toLowerCase())
    );
    if (blockedAncestor) {
      throw new BadRequest('A file already exists in this path.');
    }

    const leafDirectory = `${filePath}/`.toLowerCase();
    const pathConflict = activeFiles.find(file => {
      if (name.endsWith('/')) {
        return (
          file.kind !== 'directory' &&
          file.name.toLowerCase() === filePath.toLowerCase()
        );
      }
      return (
        file.kind === 'directory' && file.name.toLowerCase() === leafDirectory
      );
    });
    if (pathConflict) {
      throw new BadRequest('A directory already exists in this path.');
    }
  }

  private async requireContainer(id: string): Promise<WorkspaceContainerRecord> {
    const container = await this.models.container.getActive(id);
    if (!container) {
      throw new NotFound('Container not found.');
    }
    return container;
  }

  private async requireFile(
    id: string,
    status: 'active' | 'pending'
  ): Promise<WorkspaceContainerFileRecord> {
    const file = await this.models.containerFile.get(id);
    if (!file || file.status !== status || file.deletedAt) {
      throw new NotFound('Container file not found.');
    }
    return file;
  }

  private async assertCanRead(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.Containers.Read');
  }

  private async assertCanWrite(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.Containers.Write');
    await this.policy.assertWorkspaceActionAllowed(
      workspaceId,
      'Workspace.Containers.Write'
    );
  }

  private async assertCanDelete(userId: string, workspaceId: string) {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.Containers.Delete');
    await this.policy.assertWorkspaceActionAllowed(
      workspaceId,
      'Workspace.Containers.Delete'
    );
  }

  private async validateStoredFile(file: WorkspaceContainerFileRecord) {
    if (file.kind === 'directory') {
      return;
    }
    if (file.kind === 'text') {
      const buffer = await this.readStoredBuffer(file, CONTAINER_TEXT_MAX_SIZE);
      validateBuffer(file.kind, buffer);
      return;
    }
    const prefix = await this.readStoredPrefix(file, 512);
    validateBuffer(file.kind, prefix);
  }

  private async readStoredPrefix(
    file: WorkspaceContainerFileRecord,
    limit: number
  ) {
    const { body } = await this.storage.get(file.workspaceId, file.blobKey);
    if (!body) {
      throw new BlobNotFound({ spaceId: file.workspaceId, blobId: file.blobKey });
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as Readable) {
      const buffer = Buffer.from(chunk as Buffer);
      chunks.push(buffer);
      total += buffer.length;
      if (total >= limit) {
        (body as Readable).destroy();
        break;
      }
    }
    return Buffer.concat(chunks, Math.min(total, limit)).subarray(0, limit);
  }

  private async readStoredBuffer(
    file: WorkspaceContainerFileRecord,
    limit: number
  ) {
    if (file.size > limit) {
      throw new BlobQuotaExceeded('Text files must be 5 MiB or smaller.');
    }
    const { body } = await this.storage.get(file.workspaceId, file.blobKey);
    if (!body) {
      throw new BlobNotFound({ spaceId: file.workspaceId, blobId: file.blobKey });
    }
    return readableToBuffer(body as Readable);
  }
}
