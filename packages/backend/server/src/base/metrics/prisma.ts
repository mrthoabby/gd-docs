export class PrismaMetricProducer {
  async collect() {
    return {
      resourceMetrics: {
        scopeMetrics: [],
      },
      errors: [],
    };
  }
}
