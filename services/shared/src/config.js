import dotenv from 'dotenv';

// Load .env from the monorepo root (works whether run from a service dir or root)
dotenv.config();

const num = (v, d) => (v === undefined ? d : Number(v));
const list = (v, d = []) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);

export const config = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    db: process.env.MONGO_DB || 'telemetry',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    healthTtl: num(process.env.HEALTH_TTL_SECONDS, 120),
  },

  cassandra: {
    contactPoints: list(process.env.CASSANDRA_CONTACT_POINTS, ['localhost']),
    localDataCenter: process.env.CASSANDRA_LOCAL_DC || 'datacenter1',
    keyspace: process.env.CASSANDRA_KEYSPACE || 'telemetry',
    // Managed Cassandra (e.g. Azure Cosmos DB Cassandra API) needs a custom
    // port, TLS, and username/password auth. Left unset for local Cassandra.
    port: process.env.CASSANDRA_PORT ? num(process.env.CASSANDRA_PORT) : undefined,
    username: process.env.CASSANDRA_USERNAME || undefined,
    password: process.env.CASSANDRA_PASSWORD || undefined,
    ssl: /^true$/i.test(process.env.CASSANDRA_SSL || ''),
  },

  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password123',
  },

  kafka: {
    brokers: list(process.env.KAFKA_BROKERS, ['localhost:9092']),
    clientId: process.env.KAFKA_CLIENT_ID || 'orbital-telemetry',
    telemetryTopic: process.env.KAFKA_TELEMETRY_TOPIC || 'telemetry.raw',
    alertsTopic: process.env.KAFKA_ALERTS_TOPIC || 'telemetry.alerts',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'ingestion-group',
    // TLS + SASL for managed Kafka (e.g. Azure Event Hubs Kafka endpoint).
    // Left unset for local Kafka. For Event Hubs: KAFKA_SSL=true,
    // KAFKA_SASL_MECHANISM=plain, KAFKA_SASL_USERNAME=$ConnectionString,
    // KAFKA_SASL_PASSWORD=<namespace connection string>.
    ssl: /^true$/i.test(process.env.KAFKA_SSL || ''),
    saslMechanism: process.env.KAFKA_SASL_MECHANISM || undefined,
    saslUsername: process.env.KAFKA_SASL_USERNAME || undefined,
    saslPassword: process.env.KAFKA_SASL_PASSWORD || undefined,
  },

  api: {
    port: num(process.env.API_PORT, 4000),
    alertPort: num(process.env.ALERT_PORT, 4100),
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMax: num(process.env.RATE_LIMIT_MAX, 100),
  },

  simulator: {
    satellites: list(process.env.SIM_SATELLITES, ['SAT-01', 'SAT-02', 'SAT-03']),
    intervalMs: num(process.env.SIM_INTERVAL_MS, 1000),
    anomalyRate: num(process.env.SIM_ANOMALY_RATE, 0.05),
  },
};

// Fail fast in production if security-critical secrets are left at their dev defaults.
// In the cloud these come from Key Vault / GitHub secrets, never from committed defaults.
if (config.env === 'production') {
  const weak = [];
  if (config.api.jwtSecret === 'dev-secret-change-me') weak.push('JWT_SECRET');
  if (config.neo4j.password === 'password123') weak.push('NEO4J_PASSWORD');
  if (weak.length) {
    throw new Error(`Refusing to start in production with default secrets: ${weak.join(', ')}`);
  }
}

// Per-sensor-type operating thresholds (used for anomaly detection + alerts)
export const THRESHOLDS = {
  temperature: { min: -40, max: 80, unit: 'C', critical: 90 },
  battery: { min: 30, max: 100, unit: '%', critical: 20 },
  voltage: { min: 22, max: 34, unit: 'V', critical: 20 },
  signal: { min: -90, max: -40, unit: 'dBm', critical: -100 },
  pressure: { min: 95, max: 105, unit: 'kPa', critical: 110 },
};

export default config;
