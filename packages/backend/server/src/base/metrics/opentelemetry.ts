export abstract class BaseOpentelemetryOptionsFactory {
  getResource() {
    return {
      merge() {
        return this;
      },
    };
  }

  getMetricReader() {
    return null;
  }

  getSpanExporter() {
    return null;
  }

  create() {
    return {};
  }
}

export class OpentelemetryOptionsFactory extends BaseOpentelemetryOptionsFactory {}

export class OpentelemetryProvider {
  async onModuleDestroy() {}
}
