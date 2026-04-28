export type Channel = 'stable' | 'canary' | 'beta' | 'internal';

export const appIconMap = {
  stable: '/imgs/app-icon-stable.ico',
  canary: '/imgs/app-icon-canary.ico',
  beta: '/imgs/app-icon-beta.ico',
  internal: '/imgs/app-icon-internal.ico',
} satisfies Record<Channel, string>;

export const appNames = {
  stable: 'GD docs',
  canary: 'GD docs Canary',
  beta: 'GD docs Beta',
  internal: 'GD docs Internal',
} satisfies Record<Channel, string>;
