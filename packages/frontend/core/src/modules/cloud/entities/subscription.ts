import {
  catchErrorInto,
  effect,
  Entity,
  exhaustMapSwitchUntilChanged,
  fromPromise,
  LiveData,
  onComplete,
  onStart,
  smartRetry,
} from '@toeverything/infra';
import { map, tap } from 'rxjs';

import type { AuthService } from '../services/auth';
import type { SubscriptionStore } from '../stores/subscription';

export enum SubscriptionPlan {
  Free = 'Free',
  Pro = 'Pro',
  Team = 'Team',
  AI = 'AI',
}

export enum SubscriptionRecurring {
  Lifetime = 'Lifetime',
}

export enum SubscriptionVariant {
  Onetime = 'Onetime',
}

export type SubscriptionType = {
  id: string;
  plan: SubscriptionPlan;
  recurring?: SubscriptionRecurring | null;
  variant?: SubscriptionVariant | null;
};

export class Subscription extends Entity {
  // undefined means no user, null means loading
  subscription$ = new LiveData<SubscriptionType[] | null | undefined>(null);
  isRevalidating$ = new LiveData(false);
  error$ = new LiveData<any | null>(null);

  pro$ = this.subscription$.map(subscriptions =>
    subscriptions
      ? subscriptions.find(sub => sub.plan === SubscriptionPlan.Pro)
      : null
  );
  ai$ = this.subscription$.map(subscriptions =>
    subscriptions
      ? subscriptions.find(sub => sub.plan === SubscriptionPlan.AI)
      : null
  );
  isBeliever$ = this.pro$.map(
    sub => sub?.recurring === SubscriptionRecurring.Lifetime
  );
  isOnetimePro$ = this.pro$.map(
    sub => sub?.variant === SubscriptionVariant.Onetime
  );
  isOnetimeAI$ = this.ai$.map(
    sub => sub?.variant === SubscriptionVariant.Onetime
  );

  constructor(
    private readonly authService: AuthService,
    private readonly store: SubscriptionStore
  ) {
    super();
  }

  async resumeSubscription(idempotencyKey: string, plan?: SubscriptionPlan) {
    await this.store.mutateResumeSubscription(idempotencyKey, plan);
    await this.waitForRevalidation();
  }

  async cancelSubscription(idempotencyKey: string, plan?: SubscriptionPlan) {
    await this.store.mutateCancelSubscription(idempotencyKey, plan);
    await this.waitForRevalidation();
  }

  async setSubscriptionRecurring(
    idempotencyKey: string,
    recurring: SubscriptionRecurring,
    plan?: SubscriptionPlan
  ) {
    await this.store.setSubscriptionRecurring(idempotencyKey, recurring, plan);
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
    map(() => ({
      accountId: this.authService.session.account$.value?.id,
    })),
    exhaustMapSwitchUntilChanged(
      (a, b) => a.accountId === b.accountId,
      ({ accountId }) => {
        return fromPromise(async signal => {
          signal.throwIfAborted();
          if (!accountId) {
            return undefined; // no subscription if no user
          }
          return {
            userId: accountId,
            subscriptions: [],
          };
        }).pipe(
          smartRetry(),
          tap(data => {
            if (data) {
              this.store.setCachedSubscriptions(
                data.userId,
                data.subscriptions
              );
              this.subscription$.next(data.subscriptions);
            } else {
              this.subscription$.next(undefined);
            }
          }),
          catchErrorInto(this.error$),
          onStart(() => this.isRevalidating$.next(true)),
          onComplete(() => this.isRevalidating$.next(false))
        );
      },
      ({ accountId }) => {
        this.reset();
        if (!accountId) {
          this.subscription$.next(null);
        } else {
          this.subscription$.next(this.store.getCachedSubscriptions(accountId));
        }
      }
    )
  );

  reset() {
    this.subscription$.next(null);
    this.isRevalidating$.next(false);
    this.error$.next(null);
  }

  override dispose(): void {
    this.revalidate.unsubscribe();
  }
}
