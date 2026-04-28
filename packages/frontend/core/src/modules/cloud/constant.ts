import {
  OAuthProviderType,
  ServerDeploymentType,
  ServerFeature,
} from '@affine/graphql';

import type { ServerConfig, ServerMetadata } from './types';

const defaultServerConfig: ServerConfig = {
  serverName: 'GD docs Server',
  features: [
    ServerFeature.Indexer,
    ServerFeature.Copilot,
    ServerFeature.CopilotEmbedding,
    ServerFeature.OAuth,
  ],
  oauthProviders: [
    OAuthProviderType.Google,
    OAuthProviderType.Github,
    OAuthProviderType.Apple,
  ],
  type: ServerDeploymentType.Selfhosted,
  credentialsRequirement: {
    password: {
      minLength: 8,
      maxLength: 128,
    },
  },
};

export const BUILD_IN_SERVERS: (ServerMetadata & { config: ServerConfig })[] = [
  {
    id: 'affine-cloud',
    baseUrl: location.origin,
    config: defaultServerConfig,
  },
];
