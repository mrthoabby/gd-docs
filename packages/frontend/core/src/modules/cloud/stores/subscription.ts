import { Store } from '@toeverything/infra';

import {
  SubscriptionPlan,
  type SubscriptionRecurring,
  type SubscriptionType,
} from '../entities/subscription';

export class SubscriptionStore extends Store {
  async fetchSubscriptions(_abortSignal?: AbortSignal) {
    return {
      userId: '',
      subscriptions: [] as SubscriptionType[],
    };
  }

  async fetchWorkspaceSubscriptions(
    workspaceId: string,
    _abortSignal?: AbortSignal
  ) {
    return {
      workspaceId,
      subscription: null as SubscriptionType | null,
    };
  }

  async mutateResumeSubscription(
    _idempotencyKey: string,
    _plan: SubscriptionPlan = SubscriptionPlan.Free,
    _abortSignal?: AbortSignal,
    _workspaceId?: string
  ) {
    return null;
  }

  async mutateCancelSubscription(
    _idempotencyKey: string,
    _plan: SubscriptionPlan = SubscriptionPlan.Free,
    _abortSignal?: AbortSignal,
    _workspaceId?: string
  ) {
    return null;
  }

  getCachedSubscriptions(_userId: string) {
    return [] as SubscriptionType[];
  }

  setCachedSubscriptions(
    _userId: string,
    _subscriptions: SubscriptionType[]
  ) {}

  getCachedWorkspaceSubscription(_workspaceId: string) {
    return null as SubscriptionType | null;
  }

  setCachedWorkspaceSubscription(
    _workspaceId: string,
    _subscription: SubscriptionType
  ) {}

  async setSubscriptionRecurring(
    _idempotencyKey: string,
    _recurring: SubscriptionRecurring,
    _plan: SubscriptionPlan = SubscriptionPlan.Free,
    _workspaceId?: string
  ) {
    return null;
  }

  async fetchSubscriptionPrices(_abortSignal?: AbortSignal) {
    return [];
  }
}
