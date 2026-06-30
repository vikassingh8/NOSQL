// Ingestion service:
//   Kafka(telemetry.raw) → validate(Zod) → normalize → anomaly-detect
//   → write MongoDB + Cassandra + Redis → emit alerts (Kafka + Redis pub/sub)
import express from 'express';
import { config } from '@otp/shared/config';
import { createLogger } from '@otp/shared/logger';
import { createMetrics, metricsHandler } from '@otp/shared/metrics';
import { TelemetryPacketSchema } from '@otp/shared/schemas';
import { evaluate } from '@otp/shared/anomaly';
import { createConsumer, createProducer } from '@otp/shared/db/kafka';
import { connectMongo, models } from '@otp/shared/db/mongo';
import { insertTelemetryTS } from '@otp/shared/db/cassandra';
import { updateHealth, setSensorLatest, publishAlert } from '@otp/shared/db/redis';

const log = createLogger('ingestion-service');
const metrics = createMetrics('ingestion-service');

await connectMongo();
const producer = await createProducer();
const consumer = await createConsumer(config.kafka.consumerGroup);
await consumer.subscribe({ topic: config.kafka.telemetryTopic, fromBeginning: false });

log.info('ingestion service consuming telemetry');

async function handlePacket(raw) {
  const endTimer = metrics.processingLatency.startTimer();
  // 1. Validate
  const parsed = TelemetryPacketSchema.safeParse(raw);
  if (!parsed.success) {
    metrics.ingestErrors.inc({ reason: 'validation' });
    log.warn({ issues: parsed.error.issues }, 'invalid packet dropped');
    return;
  }
  const p = parsed.data;
  const ts = typeof p.ts === 'number' ? new Date(p.ts) : new Date(p.ts);

  // 2. Anomaly detection
  const { status, severity, message } = evaluate(p);
  const doc = { ...p, ts, status };

  try {
    // 3a. MongoDB — queryable telemetry log
    await models.Telemetry.create(doc);
    // 3b. Cassandra — long-term time-series
    await insertTelemetryTS(doc);
    // 3c. Redis — live health + latest snapshot
    await updateHealth(p.satelliteId, p.type, p.value, status);
    await setSensorLatest(p.sensorId, doc);

    metrics.ingested.inc({ satellite: p.satelliteId, type: p.type });

    // 4. Emit alert on breach
    if (severity) {
      const alert = {
        satelliteId: p.satelliteId,
        sensorId: p.sensorId,
        type: p.type,
        value: p.value,
        unit: p.unit,
        severity,
        message,
        ts: ts.toISOString(),
      };
      await producer.send({
        topic: config.kafka.alertsTopic,
        messages: [{ key: p.satelliteId, value: JSON.stringify(alert) }],
      });
      await publishAlert(alert); // real-time fan-out
      metrics.alertsEmitted.inc({ severity, type: p.type });
      log.warn({ alert }, 'alert emitted');
    }
  } catch (err) {
    metrics.ingestErrors.inc({ reason: 'storage' });
    log.error({ err: err.message }, 'storage failure');
  } finally {
    endTimer();
  }
}

await consumer.run({
  eachMessage: async ({ message }) => {
    try {
      await handlePacket(JSON.parse(message.value.toString()));
    } catch (err) {
      metrics.ingestErrors.inc({ reason: 'parse' });
      log.error({ err: err.message }, 'failed to parse message');
    }
  },
});

// ─── Health + metrics endpoint ───────────────────────────────────────────────
const app = express();
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'ingestion' }));
app.get('/metrics', (req, res) => metricsHandler(metrics, req, res));
app.listen(9101, () => log.info('ingestion metrics on :9101/metrics'));

const shutdown = async () => {
  await consumer.disconnect();
  await producer.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
