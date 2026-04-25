import { z } from 'zod';

import { defineModuleConfig } from '../../base';

export interface AuthConfig {
  session: {
    ttl: number;
    ttr: number;
  };
  allowSignup: boolean;
  allowSignupForOauth: boolean;
  requireEmailDomainVerification: boolean;
  requireEmailVerification: boolean;
  /**
   * Lista de dominios permitidos para nuevos registros.
   * Ej: ["miempresa.com", "otraempresa.com"]
   * Si está vacía, cualquier dominio puede registrarse (comportamiento por defecto).
   * Se aplica tanto a registro por email/password como por OAuth.
   */
  allowedEmailDomains: string[];
  /**
   * Lista de emails específicos permitidos para nuevos registros (sin importar el dominio).
   * Ej: ["externo@gmail.com", "proveedor@hotmail.com"]
   * Si está vacía, no hay restricción por email individual.
   * Funciona en combinación con allowedEmailDomains: el acceso se otorga si
   * el email está en CUALQUIERA de las dos listas.
   */
  allowedEmails: string[];
  passwordRequirements: ConfigItem<{
    min: number;
    max: number;
  }>;
}

declare global {
  interface AppConfigSchema {
    auth: AuthConfig;
  }
}

defineModuleConfig('auth', {
  allowSignup: {
    desc: 'Whether allow new registrations.',
    default: true,
  },
  allowSignupForOauth: {
    desc: 'Whether allow new registrations via configured oauth.',
    default: true,
  },
  allowedEmailDomains: {
    desc: 'Whitelist of email domains allowed to register. Empty = all domains allowed. Example: ["miempresa.com","otraempresa.com"]. Can also be set via AUTH_ALLOWED_EMAIL_DOMAINS env var (comma-separated).',
    default: [] as string[],
    env: ['AUTH_ALLOWED_EMAIL_DOMAINS', 'array'],
    schema: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  allowedEmails: {
    desc: 'Whitelist of specific email addresses allowed to register, regardless of domain. Empty = no individual restriction. Example: ["externo@gmail.com"]. Can also be set via AUTH_ALLOWED_EMAILS env var (comma-separated).',
    default: [] as string[],
    env: ['AUTH_ALLOWED_EMAILS', 'array'],
    schema: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  requireEmailDomainVerification: {
    desc: 'Whether require email domain record verification before accessing restricted resources.',
    default: false,
  },
  requireEmailVerification: {
    desc: 'Whether require email verification before accessing restricted resources(not implemented).',
    default: true,
  },
  passwordRequirements: {
    desc: 'The password strength requirements when set new password.',
    default: {
      min: 8,
      max: 32,
    },
    shape: z
      .object({
        min: z.number().min(1),
        max: z.number().max(100),
      })
      .strict()
      .refine(data => data.min < data.max, {
        message: 'Minimum length of password must be less than maximum length',
      }),
    schema: {
      type: 'object',
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
      },
    },
  },
  'session.ttl': {
    desc: 'Application auth expiration time in seconds.',
    default: 60 * 60 * 24 * 15, // 15 days
  },
  'session.ttr': {
    desc: 'Application auth time to refresh in seconds.',
    default: 60 * 60 * 24 * 7, // 7 days
  },
});
