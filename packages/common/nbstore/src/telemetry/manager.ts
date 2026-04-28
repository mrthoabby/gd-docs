import type {
  TelemetryAck,
  TelemetryContext,
  TelemetryEvent,
} from './types';

export class TelemetryManager {
  async setContext(_context: TelemetryContext) {}

  async track(_event: TelemetryEvent) {
    return { queued: false };
  }

  async pageview(_event: TelemetryEvent) {
    return { queued: false };
  }

  async flush(): Promise<TelemetryAck> {
    return { ok: true, accepted: 0, dropped: 0 };
  }

  getQueueState() {
    return {
      size: 0,
      lastError: undefined,
      nextRetryAt: undefined,
    };
  }
}
