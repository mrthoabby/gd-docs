import { z } from 'zod';

import { defineModuleConfig } from '../../base';

export interface ServerFlags {
  allowGuestDemoWorkspace: boolean;
}

declare global {
  interface AppConfigSchema {
    server: {
      externalUrl?: string;
      https: boolean;
      host: string;
      hosts: ConfigItem<string[]>;
      listenAddr: string;
      port: number;
      path: string;
      name?: string;
    };
    flags: ServerFlags;
  }
}

defineModuleConfig('server', {
  name: {
    desc: 'Nombre del servidor que aparece en la app de escritorio al conectar. Ej: "GD docs – Mi Empresa".',
    default: undefined,
    shape: z.string().optional(),
  },
  externalUrl: {
    desc: `URL base pública del servidor, usada para generar enlaces externos (magic links, invitaciones, OAuth callbacks). Si se deja vacío, se construye automáticamente desde host y puerto.`,
    default: '',
    env: 'AFFINE_SERVER_EXTERNAL_URL',
    validate: val => {
      // allow to be nullable and empty string
      if (!val) {
        return { success: true, data: val };
      }

      return z.string().url().safeParse(val);
    },
  },
  https: {
    desc: 'Whether the server is hosted on a ssl enabled domain (https://).',
    default: false,
    env: ['AFFINE_SERVER_HTTPS', 'boolean'],
    shape: z.boolean(),
  },
  host: {
    desc: 'Where the server get deployed(FQDN).',
    default: 'localhost',
    env: 'AFFINE_SERVER_HOST',
  },
  hosts: {
    desc: 'Multiple hosts the server will accept requests from.',
    default: [],
    shape: z.array(z.string()),
  },
  listenAddr: {
    desc: 'The address to listen on (e.g., 0.0.0.0 for IPv4, :: for IPv6).',
    default: '0.0.0.0',
    env: 'LISTEN_ADDR',
  },
  port: {
    desc: 'Which port the server will listen on.',
    default: 3010,
    env: ['AFFINE_SERVER_PORT', 'integer'],
  },
  path: {
    desc: 'Subruta donde está desplegado el servidor, si aplica. Ej: /docs',
    default: '',
    env: 'AFFINE_SERVER_SUB_PATH',
  },
});

defineModuleConfig('flags', {
  allowGuestDemoWorkspace: {
    desc: 'Whether allow guest users to create demo workspaces.',
    default: true,
  },
});
