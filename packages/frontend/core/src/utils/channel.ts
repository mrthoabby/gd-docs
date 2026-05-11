export type Channel = 'stable' | 'canary' | 'beta' | 'internal';

export const appIconMap = {
  stable: '/imgs/documentor-logo.svg',
  canary: '/imgs/documentor-logo.svg',
  beta: '/imgs/documentor-logo.svg',
  internal: '/imgs/documentor-logo.svg',
} satisfies Record<Channel, string>;

export const appNames = {
  stable: 'Documentor',
  canary: 'Documentor Canary',
  beta: 'Documentor Beta',
  internal: 'Documentor Internal',
} satisfies Record<Channel, string>;
