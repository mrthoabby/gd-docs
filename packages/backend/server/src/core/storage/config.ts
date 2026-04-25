import {
  defineModuleConfig,
  StorageJSONSchema,
  StorageProviderConfig,
} from '../../base';

export interface Storages {
  avatar: {
    storage: ConfigItem<StorageProviderConfig>;
    publicPath: string;
    /**
     * Public URL of the storage endpoint reachable by browsers.
     * When set, presigned upload URLs for avatars use this hostname so
     * browsers can upload directly without passing through the server.
     * Leave empty (default) to proxy all avatar uploads through the server.
     */
    publicEndpoint: string;
  };
  blob: {
    storage: ConfigItem<StorageProviderConfig>;
    /**
     * Public URL of the storage endpoint reachable by browsers.
     * When set, presigned upload URLs use this hostname so browsers can
     * upload blobs (images, videos, etc.) directly to storage without
     * passing through the GD docs server.
     * Leave empty (default) to proxy all uploads through the server.
     *
     * Example: https://storage.your-domain.com
     * Useful after setting up a reverse proxy in front of MinIO or when
     * using a managed S3-compatible service with a public endpoint.
     */
    publicEndpoint: string;
  };
}

declare global {
  interface AppConfigSchema {
    storages: Storages;
  }
}

defineModuleConfig('storages', {
  'avatar.publicPath': {
    desc: 'The public accessible path prefix for user avatars.',
    default: '/api/avatars/',
  },
  'avatar.storage': {
    desc: 'The config of storage for user avatars.',
    default: {
      provider: 'fs',
      bucket: 'avatars',
      config: {
        path: '~/.affine/storage',
      },
    },
    schema: StorageJSONSchema,
  },
  'avatar.publicEndpoint': {
    desc: 'Public URL of the storage endpoint reachable by browsers for avatar uploads. Leave empty to proxy uploads through the server.',
    default: '',
  },
  'blob.storage': {
    desc: 'The config of storage for all uploaded blobs(images, videos, etc.).',
    default: {
      provider: 'fs',
      bucket: 'blobs',
      config: {
        path: '~/.affine/storage',
      },
    },
    schema: StorageJSONSchema,
  },
  'blob.publicEndpoint': {
    desc: 'Public URL of the storage endpoint reachable by browsers for blob uploads. Leave empty to proxy uploads through the server.',
    default: '',
  },
});
