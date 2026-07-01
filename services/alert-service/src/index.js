// Alert service:
//   consumes Kafka(telemetry.alerts) → persists to MongoDB → broadcasts live over WebSocket.
//   Also exposes SSE (/alerts/stream) + REST (/alerts) for clients that prefer HTTP.
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { initTelemetry } from '@otp/shared/telemetry';
import { config } from '@otp/shared/config';
import { createLogger } from '@otp/shared/logger';

await initTelemetry('alert-service');
import { createMetrics, metricsHandler } from '@otp/shared/metrics';
import { AlertSchema } from '@otp/shared/schemas';
import { createConsumer } from '@otp/shared/db/kafka';
import { connectMongo, models } from '@otp/shared/db/mongo';
import { recordFailure, disconnectNeo4j } from '@otp/shared/db/neo4j';
import { cacheAlert, disconnectRedis } from '@otp/shared/db/redis';

const log = createLogger('alert-service');
const metrics = createMetrics('alert-service');

await connectMongo();

const app = express();
app.use(cors());
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'alert' }));
app.get('/metrics', (req, res) => metricsHandler(metrics, req, res));

// Recent alerts over plain REST
app.get('/alerts', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const alerts = await models.Alert.find().sort({ ts: -1 }).limit(limit).lean();
  res.json({ count: alerts.length, alerts });
});

// SSE stream
const sseClients = new Set();
app.get('/alerts/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

const server = http.createServer(app);

// WebSocket fan-out
const wss = new WebSocketServer({ server, path: '/ws/alerts' });
wss.on('connection', () => log.info({ clients: wss.clients.size }, 'ws client connected'));

function broadcast(alert) {
  const payload = JSON.stringify(alert);
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(payload);
  for (const res of sseClients) res.write(`data: ${payload}\n\n`);
}

// Maps the breaching sensor type to the responsible module (mirrors the Neo4j topology),
// so a CRITICAL alert can be recorded as a failure event against that module.
const TYPE_TO_MODULE = {
  temperature: 'Heater',
  battery: 'BatteryPack',
  voltage: 'PowerBus',
  signal: 'Transceiver',
  pressure: 'Thruster',
};

// Threshold engine consumer: persist + record failures + broadcast
const consumer = await createConsumer('alert-group');
await consumer.subscribe({ topic: config.kafka.alertsTopic, fromBeginning: false });
await consumer.run({
  eachMessage: async ({ message }) => {
    try {
      const parsed = AlertSchema.safeParse(JSON.parse(message.value.toString()));
      if (!parsed.success) return;
      const alert = parsed.data;
      const saved = await models.Alert.create({ ...alert, ts: new Date(alert.ts) });
      metrics.alertsEmitted.inc({ severity: alert.severity, type: alert.type });

      // Ephemeral mission-alert cache in Redis (low-latency live reads).
      try {
        await cacheAlert({ ...alert, _id: saved._id });
      } catch (err) {
        log.error({ err: err.message }, 'failed to cache alert in redis');
      }

      // A critical breach is logged as a failure event against the responsible module.
      if (alert.severity === 'critical') {
        const module = TYPE_TO_MODULE[alert.type] || alert.type;
        await models.FailureEvent.create({
          satelliteId: alert.satelliteId,
          module,
          cause: alert.message,
          ts: new Date(alert.ts),
        });
        // Mirror into the graph (FailureEvent)-[:AFFECTS]->(Module) for fault-tree queries.
        // Non-fatal: a graph error must never block alert persistence/broadcast.
        try {
          await recordFailure({ satelliteId: alert.satelliteId, module, cause: alert.message, ts: alert.ts });
        } catch (err) {
          log.error({ err: err.message }, 'failed to record failure in graph');
        }
      }

      broadcast({ ...alert, _id: saved._id });
      log.warn({ severity: alert.severity, sat: alert.satelliteId }, 'alert persisted + broadcast');
    } catch (err) {
      log.error({ err: err.message }, 'failed to handle alert');
    }
  },
});

server.listen(config.api.alertPort, () =>
  log.info(`alert service on :${config.api.alertPort} (ws: /ws/alerts, sse: /alerts/stream)`)
);

const shutdown = async () => {
  await consumer.disconnect();
  await disconnectNeo4j();
  await disconnectRedis();
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
