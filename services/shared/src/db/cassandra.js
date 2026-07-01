import cassandra from 'cassandra-driver';
import { config } from '../config.js';

let client;

// Build driver options, adding port/TLS/auth only when configured (managed
// Cassandra such as Azure Cosmos DB Cassandra API). Local Cassandra omits them.
function clientOptions(extra = {}) {
  const opts = {
    contactPoints: config.cassandra.contactPoints,
    localDataCenter: config.cassandra.localDataCenter,
    ...extra,
  };
  if (config.cassandra.port) opts.protocolOptions = { port: config.cassandra.port };
  if (config.cassandra.ssl) opts.sslOptions = { rejectUnauthorized: false };
  if (config.cassandra.username && config.cassandra.password) {
    opts.authProvider = new cassandra.auth.PlainTextAuthProvider(
      config.cassandra.username,
      config.cassandra.password
    );
  }
  return opts;
}

// Connect without a keyspace (used by the seed/DDL bootstrap)
export function rawClient() {
  return new cassandra.Client(clientOptions());
}

export async function getCassandra() {
  if (client) return client;
  client = new cassandra.Client(clientOptions({ keyspace: config.cassandra.keyspace }));
  await client.connect();
  return client;
}

const bucketDay = (date) => date.toISOString().slice(0, 10); // YYYY-MM-DD

// Insert one time-series datapoint
export async function insertTelemetryTS({ satelliteId, sensorId, type, value, unit, status, ts }) {
  const c = await getCassandra();
  const eventTime = ts instanceof Date ? ts : new Date(ts);
  const query = `INSERT INTO telemetry_ts
    (satellite_id, sensor_id, bucket_day, event_time, type, value, unit, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  await c.execute(
    query,
    [satelliteId, sensorId, bucketDay(eventTime), eventTime, type, value, unit, status],
    { prepare: true }
  );
}

// Query recent history for a sensor (walks back day-buckets until limit is met)
export async function queryHistory({ satelliteId, sensorId, from, to, limit = 500 }) {
  const c = await getCassandra();
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 24 * 3600 * 1000);
  const rows = [];

  for (let d = new Date(end); d >= start && rows.length < limit; d.setDate(d.getDate() - 1)) {
    const query = `SELECT satellite_id, sensor_id, event_time, type, value, unit, status
      FROM telemetry_ts
      WHERE satellite_id = ? AND sensor_id = ? AND bucket_day = ?
        AND event_time >= ? AND event_time <= ?
      LIMIT ?`;
    const res = await c.execute(
      query,
      [satelliteId, sensorId, bucketDay(d), start, end, limit - rows.length],
      { prepare: true }
    );
    rows.push(...res.rows);
  }
  return rows;
}

export async function disconnectCassandra() {
  if (client) await client.shutdown();
  client = undefined;
}
