import { ServerDeploymentType } from '@affine/graphql';
import { Service } from '@toeverything/infra';

import type { Server } from '../entities/server';
import type { ServersService } from './servers';

export class DefaultServerService extends Service {
  server!: Server;

  constructor(private readonly serversService: ServersService) {
    super();

    // global server is always affine-cloud. Keep a live subscription so the
    // Server entity held by ObjectPool is not GC'ed while this service uses it.
    const defaultServer$ = this.serversService.server$('affine-cloud');
    const subscription = defaultServer$.subscribe(server => {
      if (server) {
        this.server = server;
      }
    });
    this.disposables.push(() => subscription.unsubscribe());

    const server = defaultServer$.value;
    if (!server) {
      throw new Error('No server found');
    }
    this.server = server;
  }

  async waitForSelfhostedServerConfig() {
    if (this.server.config$.value.type === ServerDeploymentType.Selfhosted) {
      await this.server.waitForConfigRevalidation();
    }
  }
}
