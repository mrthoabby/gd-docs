export type MetricOptions = {
  description?: string;
  unit?: string;
};

type Attributes = Record<string, unknown>;

type UpDownCounter = {
  add(value: number, attributes?: Attributes): void;
};

type Gauge = {
  record(value: number, attributes?: Attributes): void;
};

type Histogram = {
  record(value: number, attributes?: Attributes): void;
};

export function registerCustomMetrics() {
  // Metrics are disabled in the slim self-hosted build.
}

export function getMeter(_name = 'business') {
  return null;
}

type MetricType = 'counter' | 'gauge' | 'histogram';
type Metric<T extends MetricType> = T extends 'counter'
  ? UpDownCounter
  : T extends 'gauge'
    ? Gauge
    : T extends 'histogram'
      ? Histogram
      : never;

type MetricCreators = {
  [T in MetricType]: (name: string, opts?: MetricOptions) => Metric<T>;
};

export type ScopedMetrics = {
  counter: (name: string, opts?: MetricOptions) => UpDownCounter;
  gauge: (name: string, opts?: MetricOptions) => Gauge;
  histogram: (name: string, opts?: MetricOptions) => Histogram;
};

export type KnownMetricScopes =
  | 'socketio'
  | 'gql'
  | 'jwst'
  | 'auth'
  | 'controllers'
  | 'doc'
  | 'sse'
  | 'mail'
  | 'ai'
  | 'event'
  | 'queue'
  | 'storage'
  | 'process'
  | 'workspace';

const metricCreators: MetricCreators = {
  counter(_name: string, _opts?: MetricOptions) {
    return { add() {} } satisfies UpDownCounter;
  },
  gauge(_name: string, _opts?: MetricOptions) {
    return { record() {} } satisfies Gauge;
  },
  histogram(_name: string, _opts?: MetricOptions) {
    return { record() {} } satisfies Histogram;
  },
};

const scopes = new Map<string, ScopedMetrics>();

function make(scope: string) {
  const metrics = new Map<string, { type: MetricType; metric: any }>();
  const prefix = scope + '/';

  function getOrCreate<T extends MetricType>(
    type: T,
    name: string,
    opts?: MetricOptions
  ): Metric<T> {
    name = prefix + name;
    const metric = metrics.get(name);
    if (metric) {
      if (type !== metric.type) {
        throw new Error(
          `Metric ${name} has already been registered as ${metric.type} mode, but get as ${type} again.`
        );
      }

      return metric.metric;
    } else {
      const metric = metricCreators[type](name, opts);
      metrics.set(name, { type, metric });
      return metric;
    }
  }

  return {
    counter(name, opts) {
      return getOrCreate('counter', name, opts);
    },
    gauge(name, opts) {
      return getOrCreate('gauge', name, opts);
    },
    histogram(name, opts) {
      return getOrCreate('histogram', name, opts);
    },
  } satisfies ScopedMetrics;
}

/**
 * @example
 *
 * ```
 * metrics.scope.counter('example_count').add(1, {
 *   attr1: 'example-event'
 * })
 * ```
 */
export const metrics = new Proxy<Record<KnownMetricScopes, ScopedMetrics>>(
  // @ts-expect-error proxied
  {},
  {
    get(_, scopeName: string) {
      let scope = scopes.get(scopeName);
      if (!scope) {
        scope = make(scopeName);
        scopes.set(scopeName, scope);
      }

      return scope;
    },
  }
);
