import client from 'prom-client';

// One registry per process; default Node/process metrics included.
export function createMetrics(serviceName) {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: serviceName });
  client.collectDefaultMetrics({ register: registry });

  const ingested = new client.Counter({
    name: 'telemetry_ingested_total',
    help: 'Total telemetry packets successfully ingested',
    labelNames: ['satellite', 'type'],
    registers: [registry],
  });

  const ingestErrors = new client.Counter({
    name: 'telemetry_ingest_errors_total',
    help: 'Total telemetry packets that failed validation/processing',
    labelNames: ['reason'],
    registers: [registry],
  });

  const alertsEmitted = new client.Counter({
    name: 'alerts_emitted_total',
    help: 'Total alerts emitted',
    labelNames: ['severity', 'type'],
    registers: [registry],
  });

  const processingLatency = new client.Histogram({
    name: 'telemetry_processing_seconds',
    help: 'Per-packet processing latency',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [registry],
  });

  const httpLatency = new client.Histogram({
    name: 'http_request_seconds',
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
    registers: [registry],
  });

  return { registry, ingested, ingestErrors, alertsEmitted, processingLatency, httpLatency };
}

// Express middleware to record HTTP latency + expose /metrics
export function metricsMiddleware(metrics) {
  return (req, res, next) => {
    const end = metrics.httpLatency.startTimer();
    res.on('finish', () => {
      end({ method: req.method, route: req.route?.path || req.path, status: res.statusCode });
    });
    next();
  };
}

export async function metricsHandler(metrics, req, res) {
  res.set('Content-Type', metrics.registry.contentType);
  res.end(await metrics.registry.metrics());
}
