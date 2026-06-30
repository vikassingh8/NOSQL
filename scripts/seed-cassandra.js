// Creates the Cassandra keyspace + telemetry_ts table (idempotent).
import { rawClient } from '@otp/shared/db/cassandra';
import { config } from '@otp/shared/config';

const ddl = [
  `CREATE KEYSPACE IF NOT EXISTS ${config.cassandra.keyspace}
     WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`,
  `CREATE TABLE IF NOT EXISTS ${config.cassandra.keyspace}.telemetry_ts (
     satellite_id text, sensor_id text, bucket_day date, event_time timestamp,
     type text, value double, unit text, status text,
     PRIMARY KEY ((satellite_id, sensor_id, bucket_day), event_time)
   ) WITH CLUSTERING ORDER BY (event_time DESC)`,
];

const client = rawClient();
await client.connect();
for (const q of ddl) {
  await client.execute(q);
  console.log('[cassandra] applied:', q.split('\n')[0].trim());
}
await client.shutdown();
console.log('[cassandra] schema ready ✔');
