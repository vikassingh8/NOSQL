-- Cassandra keyspace + wide-column time-series table for telemetry.
-- Partition by (satellite_id, sensor_id, bucket_day) so each partition stays bounded
-- to one day of one sensor; cluster by event_time DESC for fast "latest N" reads.

CREATE KEYSPACE IF NOT EXISTS telemetry
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE telemetry;

CREATE TABLE IF NOT EXISTS telemetry_ts (
  satellite_id text,
  sensor_id    text,
  bucket_day   date,
  event_time   timestamp,
  type         text,
  value        double,
  unit         text,
  status       text,
  PRIMARY KEY ((satellite_id, sensor_id, bucket_day), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);
