// Express app factory (exported so tests can mount it without binding a port).
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { config } from '@otp/shared/config';
import { createLogger } from '@otp/shared/logger';
import { createMetrics, metricsMiddleware, metricsHandler } from '@otp/shared/metrics';
import { signToken, authenticate, requireRole } from '@otp/shared/auth';
import { LoginSchema, HistoryQuerySchema } from '@otp/shared/schemas';
import { models } from '@otp/shared/db/mongo';
import { getHealth, listSatellites } from '@otp/shared/db/redis';
import { queryHistory } from '@otp/shared/db/cassandra';
import { impactAnalysis, dependencyGraph } from '@otp/shared/db/neo4j';

const log = createLogger('api-service');

export function createApp() {
  const app = express();
  const metrics = createMetrics('api-service');

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(metricsMiddleware(metrics));
  app.use(
    rateLimit({
      windowMs: config.api.rateLimitWindowMs,
      max: config.api.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Audit-log middleware for authenticated mutations/queries
  const audit = (action) => async (req, _res, next) => {
    try {
      await models.AuditLog?.create({ username: req.user?.username, action, path: req.originalUrl });
    } catch { /* non-fatal */ }
    next();
  };

  // ─── Public ────────────────────────────────────────────────────────────────
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'api' }));
  app.get('/metrics', (req, res) => metricsHandler(metrics, req, res));

  app.post('/auth/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
    const { username, password } = parsed.data;
    const user = await models.User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ sub: user.username, username: user.username, role: user.role });
    res.json({ token, role: user.role, expiresIn: config.api.jwtExpiresIn });
  });

  // ─── Protected ───────────────────────────────────────────────────────────────
  app.use(authenticate);

  app.get('/satellites', async (_req, res) => {
    const [fromRedis, fromMongo] = await Promise.all([listSatellites(), models.Satellite.find().lean()]);
    res.json({ live: fromRedis, catalog: fromMongo });
  });

  app.get('/satellites/:id/health', audit('read-health'), async (req, res) => {
    const health = await getHealth(req.params.id);
    if (!health || Object.keys(health).length === 0) {
      return res.status(404).json({ error: 'No live health for satellite (is the simulator running?)' });
    }
    res.json({ satelliteId: req.params.id, health });
  });

  app.get('/telemetry/:id/snapshot', requireRole('scientist', 'mission-ops'), audit('read-snapshot'), async (req, res) => {
    const docs = await models.Telemetry.find({ satelliteId: req.params.id })
      .sort({ ts: -1 })
      .limit(20)
      .lean();
    res.json({ satelliteId: req.params.id, recent: docs });
  });

  app.get('/telemetry/:id/history', requireRole('scientist', 'mission-ops'), audit('read-history'), async (req, res) => {
    const parsed = HistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });
    const { sensorId, from, to, limit } = parsed.data;
    if (!sensorId) return res.status(400).json({ error: 'sensorId is required' });
    const rows = await queryHistory({ satelliteId: req.params.id, sensorId, from, to, limit });
    res.json({ satelliteId: req.params.id, sensorId, count: rows.length, rows });
  });

  // Aggregated stats per sensor type over a recent window (for dashboard summaries).
  app.get('/telemetry/:id/aggregate', requireRole('scientist', 'mission-ops'), audit('read-aggregate'), async (req, res) => {
    const minutes = Math.min(Number(req.query.minutes) || 60, 1440);
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const summary = await models.Telemetry.aggregate([
      { $match: { satelliteId: req.params.id, ts: { $gte: since } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          lastStatus: { $last: '$status' },
        },
      },
      { $project: { _id: 0, type: '$_id', count: 1, avg: { $round: ['$avg', 2] }, min: 1, max: 1, lastStatus: 1 } },
    ]);
    res.json({ satelliteId: req.params.id, windowMinutes: minutes, summary });
  });

  app.get('/failures', requireRole('mission-ops'), audit('read-failures'), async (req, res) => {
    const filter = req.query.satelliteId ? { satelliteId: req.query.satelliteId } : {};
    const failures = await models.FailureEvent.find(filter).sort({ ts: -1 }).limit(100).lean();
    res.json({ count: failures.length, failures });
  });

  app.get('/graph/:id', requireRole('scientist', 'mission-ops'), audit('read-graph'), async (req, res) => {
    res.json({ satelliteId: req.params.id, graph: await dependencyGraph(req.params.id) });
  });

  app.get('/graph/:id/impact', requireRole('scientist', 'mission-ops'), audit('read-impact'), async (req, res) => {
    const moduleName = req.query.module;
    if (!moduleName) return res.status(400).json({ error: 'module query param required' });
    res.json(await impactAnalysis(req.params.id, moduleName));
  });

  app.get('/alerts', requireRole('mission-ops'), audit('read-alerts'), async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const filter = req.query.satelliteId ? { satelliteId: req.query.satelliteId } : {};
    const alerts = await models.Alert.find(filter).sort({ ts: -1 }).limit(limit).lean();
    res.json({ count: alerts.length, alerts });
  });

  app.use((err, _req, res, _next) => {
    log.error({ err: err.message }, 'unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
