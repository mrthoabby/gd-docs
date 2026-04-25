/* oxlint-disable @typescript-eslint/no-non-null-assertion */
import { Readable } from 'node:stream';

import type {
  S3CompatClient,
  S3CompatConfig,
  S3CompatCredentials,
} from '@affine/s3-compat';
import { createS3CompatClient } from '@affine/s3-compat';
import { Logger } from '@nestjs/common';

import {
  BlobInputType,
  GetObjectMetadata,
  ListObjectsMetadata,
  MultipartUploadInit,
  MultipartUploadPart,
  PresignedUpload,
  PutObjectMetadata,
  StorageProvider,
} from './provider';
import { autoMetadata, SIGNED_URL_EXPIRED, toBuffer } from './utils';

export interface S3StorageConfig {
  endpoint?: string;
  region: string;
  credentials: S3CompatCredentials;
  forcePathStyle?: boolean;
  requestTimeoutMs?: number;
  minPartSize?: number;
  presign?: {
    expiresInSeconds?: number;
    signContentTypeForPut?: boolean;
  };
  usePresignedURL?: {
    enabled: boolean;
  };
  /**
   * When true, the server proxies all uploads through itself instead of
   * returning presigned S3/MinIO URLs to the client.
   *
   * Set this to true for self-hosted deployments where MinIO (or S3) is
   * NOT directly reachable by browsers (i.e. only accessible on the
   * internal Docker network).  Uploads use the standard GraphQL mutation
   * and the server streams the data to MinIO on behalf of the client.
   *
   * Reads are always proxied server-side regardless of this flag.
   */
  disablePresign?: boolean;
}

function resolveEndpoint(config: S3StorageConfig) {
  if (config.endpoint) {
    return config.endpoint;
  }
  if (config.region === 'us-east-1') {
    return 'https://s3.amazonaws.com';
  }
  return `https://s3.${config.region}.amazonaws.com`;
}

export class S3StorageProvider implements StorageProvider {
  protected logger: Logger;
  /** Client used for all server-side operations (uses internal endpoint). */
  protected client: S3CompatClient;
  /**
   * Separate client used exclusively for generating presigned URLs.
   * When publicEndpoint is configured it uses that URL so the signed URLs
   * are reachable by browsers.  Falls back to `client` when not set.
   */
  private readonly presignClient: S3CompatClient;
  private readonly usePresignedURL: boolean;
  private readonly disablePresign: boolean;

  constructor(
    config: S3StorageConfig,
    public readonly bucket: string
  ) {
    const {
      usePresignedURL,
      presign,
      credentials,
      disablePresign,
      publicEndpoint,
      ...clientConfig
    } = config;

    const presignConfig: S3CompatConfig = {
      ...clientConfig,
      endpoint: resolveEndpoint(config),
      bucket,
      requestTimeoutMs: clientConfig.requestTimeoutMs ?? 60_000,
      presign: {
        expiresInSeconds: presign?.expiresInSeconds ?? SIGNED_URL_EXPIRED,
        signContentTypeForPut: presign?.signContentTypeForPut ?? true,
      },
    };

    // Internal client — always uses the configured endpoint (e.g. http://minio:9000)
    this.client = createS3CompatClient(presignConfig, credentials);

    // Presign client — uses publicEndpoint when set so the signed URLs carry
    // a hostname the browser can resolve.  Otherwise reuses the same client.
    if (publicEndpoint) {
      this.presignClient = createS3CompatClient(
        { ...presignConfig, endpoint: publicEndpoint },
        credentials
      );
    } else {
      this.presignClient = this.client;
    }

    this.usePresignedURL = usePresignedURL?.enabled ?? false;
    // publicEndpoint being set means the operator explicitly wants direct
    // browser→storage uploads; it overrides any disablePresign flag.
    this.disablePresign = publicEndpoint ? false : (disablePresign ?? false);
    this.logger = new Logger(`${S3StorageProvider.name}:${bucket}`);
  }

  async put(
    key: string,
    body: BlobInputType,
    metadata: PutObjectMetadata = {}
  ): Promise<void> {
    const blob = await toBuffer(body);

    metadata = autoMetadata(blob, metadata);

    try {
      await this.client.putObject(key, blob, {
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
      });

      this.logger.verbose(`Object \`${key}\` put`);
    } catch (e) {
      this.logger.error(
        `Failed to put object (${JSON.stringify({
          key,
          bucket: this.bucket,
          metadata,
        })})`
      );
      throw e;
    }
  }

  async presignPut(
    key: string,
    metadata: PutObjectMetadata = {}
  ): Promise<PresignedUpload | undefined> {
    // disablePresign=true → uploads go through the GD docs server (GRAPHQL method)
    // instead of directing the browser to MinIO directly (internal URL unreachable)
    if (this.disablePresign) return undefined;
    try {
      const contentType = metadata.contentType ?? 'application/octet-stream';
      const result = await this.presignClient.presignPutObject(key, { contentType });

      return {
        url: result.url,
        headers: result.headers,
        expiresAt: result.expiresAt,
      };
    } catch (e) {
      this.logger.error(
        `Failed to presign put object (${JSON.stringify({
          key,
          bucket: this.bucket,
          metadata,
        })}`
      );
      throw e;
    }
  }

  async createMultipartUpload(
    key: string,
    metadata: PutObjectMetadata = {}
  ): Promise<MultipartUploadInit | undefined> {
    if (this.disablePresign) return undefined;
    try {
      const contentType = metadata.contentType ?? 'application/octet-stream';
      const response = await this.client.createMultipartUpload(key, {
        contentType,
      });

      if (!response.uploadId) {
        return;
      }

      return {
        uploadId: response.uploadId,
        expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRED * 1000),
      };
    } catch (e) {
      this.logger.error(
        `Failed to create multipart upload (${JSON.stringify({
          key,
          bucket: this.bucket,
          metadata,
        })}`
      );
      throw e;
    }
  }

  async presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<PresignedUpload | undefined> {
    if (this.disablePresign) return undefined;
    try {
      const result = await this.presignClient.presignUploadPart(
        key,
        uploadId,
        partNumber
      );

      return {
        url: result.url,
        expiresAt: result.expiresAt,
      };
    } catch (e) {
      this.logger.error(
        `Failed to presign upload part (${JSON.stringify({ key, bucket: this.bucket, uploadId, partNumber })}`
      );
      throw e;
    }
  }

  async listMultipartUploadParts(
    key: string,
    uploadId: string
  ): Promise<MultipartUploadPart[] | undefined> {
    try {
      return await this.client.listParts(key, uploadId);
    } catch (e) {
      this.logger.error(`Failed to list multipart upload parts for \`${key}\``);
      throw e;
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[]
  ): Promise<void> {
    try {
      const orderedParts = [...parts].sort(
        (left, right) => left.partNumber - right.partNumber
      );

      await this.client.completeMultipartUpload(key, uploadId, orderedParts);
    } catch (e) {
      this.logger.error(`Failed to complete multipart upload for \`${key}\``);
      throw e;
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.abortMultipartUpload(key, uploadId);
    } catch (e) {
      this.logger.error(`Failed to abort multipart upload for \`${key}\``);
      throw e;
    }
  }

  async head(key: string) {
    try {
      const obj = await this.client.headObject(key);
      if (!obj) {
        this.logger.verbose(`Object \`${key}\` not found`);
        return undefined;
      }

      return {
        contentType: obj.contentType ?? 'application/octet-stream',
        contentLength: obj.contentLength ?? 0,
        lastModified: obj.lastModified ?? new Date(0),
        checksumCRC32: obj.checksumCRC32,
      };
    } catch (e) {
      this.logger.error(`Failed to head object \`${key}\``);
      throw e;
    }
  }

  async get(
    key: string,
    signedUrl?: boolean
  ): Promise<{
    body?: Readable;
    metadata?: GetObjectMetadata;
    redirectUrl?: string;
  }> {
    try {
      if (this.usePresignedURL && signedUrl) {
        const metadata = await this.head(key);
        if (metadata) {
          const result = await this.presignClient.presignGetObject(key);

          return {
            redirectUrl: result.url,
            metadata,
          };
        }

        // object not found
        return {};
      }

      const obj = await this.client.getObjectResponse(key);
      if (!obj || !obj.body) {
        this.logger.verbose(`Object \`${key}\` not found`);
        return {};
      }

      const contentType = obj.headers.get('content-type') ?? undefined;
      const contentLengthHeader = obj.headers.get('content-length');
      const contentLength = contentLengthHeader
        ? Number(contentLengthHeader)
        : undefined;
      const lastModifiedHeader = obj.headers.get('last-modified');
      const lastModified = lastModifiedHeader
        ? new Date(lastModifiedHeader)
        : undefined;

      this.logger.verbose(`Read object \`${key}\``);
      return {
        body: Readable.fromWeb(obj.body),
        metadata: {
          contentType: contentType ?? 'application/octet-stream',
          contentLength: contentLength ?? 0,
          lastModified: lastModified ?? new Date(0),
          checksumCRC32: obj.headers.get('x-amz-checksum-crc32') ?? undefined,
        },
      };
    } catch (e) {
      this.logger.error(`Failed to read object \`${key}\``);
      throw e;
    }
  }

  async list(prefix?: string): Promise<ListObjectsMetadata[]> {
    try {
      const result = await this.client.listObjectsV2(prefix);

      this.logger.verbose(
        `List ${result.length} objects with prefix \`${prefix}\``
      );
      return result;
    } catch (e) {
      this.logger.error(`Failed to list objects with prefix \`${prefix}\``);
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.deleteObject(key);

      this.logger.verbose(`Deleted object \`${key}\``);
    } catch (e) {
      this.logger.error(`Failed to delete object \`${key}\``, {
        bucket: this.bucket,
        key,
        cause: e,
      });
      throw e;
    }
  }
}
