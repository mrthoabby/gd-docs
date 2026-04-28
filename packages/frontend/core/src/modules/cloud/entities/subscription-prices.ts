import { Entity, LiveData } from '@toeverything/infra';

export class SubscriptionPrices extends Entity {
  prices$ = new LiveData<[]>([]);
  isRevalidating$ = new LiveData(false);
  error$ = new LiveData<any | null>(null);
  proPrice$ = new LiveData(null);
  aiPrice$ = new LiveData(null);
  teamPrice$ = new LiveData(null);
  readableLifetimePrice$ = new LiveData('');

  revalidate() {}
}
