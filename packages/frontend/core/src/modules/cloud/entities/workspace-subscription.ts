import {
  catchErrorInto,
  effect,
  Entity,
  exhaustMapWithTrailing,
  fromPromise,
  LiveData,
  onComplete,
  onStart,
  smartRetry,
} from '@toeverything/infra';
import { tap } from 'rxjs';

import type { WorkspaceService } from '../../workspace';
import {
  SubscriptionPlan,
  type SubscriptionRecurring,
  type SubscriptionType,
} from './subscription';
import { SubscriptionStore } from '../stores/subscription';

export class WorkspaceSubscription extends Entity {
  subscription$ = new LiveData<SubscriptionType | null | undefined>(null);
  isRevalidating$ = new LiveData(false);
  error$ = new LiveData<any | null>(null);

  team$ = this.subscription$.map(
    subscription => subscription?.plan === SubscriptionPlan.Team
  );

  constructor(
    private readonly workspaceService: WorkspaceService
  ) {
    super();
  }
  store = this.framework.get(SubscriptionStore);

  async resumeSubscription(idempotencyKey: string, plan?: SubscriptionPlan) {
    if (!this.store) {
      throw new Error('Subscription store not available');
    }
    await this.store.mutateResumeSubscription(
      idempotencyKey,
      plan,
      undefined,
      this.workspaceService.workspace.id
    );
    await this.waitForRevalidation();
  }

  async cancelSubscription(idempotencyKey: string, plan?: SubscriptionPlan) {
    if (!this.store) {
      throw new Error('Subscription store not available');
    }
    await this.store.mutateCancelSubscription(
      idempotencyKey,
      plan,
      undefined,
      this.workspaceService.workspace.id
    );
    await this.waitForRevalidation();
  }

  async setSubscriptionRecurring(
    idempotencyKey: string,
    recurring: SubscriptionRecurring,
    plan?: SubscriptionPlan
  ) {
    if (!this.store) {
      throw new Error('Subscription store not available');
    }
    await this.store.setSubscriptionRecurring(
      idempotencyKey,
      recurring,
      plan,
      this.workspaceService.workspace.id
    );
    await this.waitForRevalidation();
  }

  async waitForRevalidation(signal?: AbortSignal) {
    this.revalidate();
    await this.isRevalidating$.waitFor(
      isRevalidating => !isRevalidating,
      signal
    );
  }

  revalidate = effect(
    exhaustMapWithTrailing(() => {
      return fromPromise(async signal => {
        signal.throwIfAborted();
        const currentWorkspaceId = this.workspaceService.workspace.id;
        if (!currentWorkspaceId) {
          return undefined; // no subscription if no user
        }

        return {
          workspaceId: currentWorkspaceId,
          subscription: null,
        };
      }).pipe(
        smartRetry(),
        tap(data => {
          if (data && data.subscription && data.workspaceId && this.store) {
            this.store.setCachedWorkspaceSubscription(
              data.workspaceId,
              data.subscription
            );
            this.subscription$.next(data.subscription);
          } else {
            this.subscription$.next(undefined);
          }
        }),
        catchErrorInto(this.error$),
        onStart(() => this.isRevalidating$.next(true)),
        onComplete(() => this.isRevalidating$.next(false))
      );
    })
  );

  reset() {
    this.subscription$.next(null);
    this.team$.next(false);
    this.isRevalidating$.next(false);
    this.error$.next(null);
  }

  override dispose(): void {
    this.revalidate.unsubscribe();
  }
}
