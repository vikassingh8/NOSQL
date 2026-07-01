# ingestion-service

Phase 3 telemetry ingestion microservice. Consumes raw telemetry from Kafka, validates
and normalizes each packet, runs anomaly detection, fans the result out to the three
data stores, and emits alerts.

## Pipeline
```
Kafka(telemetry.raw)
  → validate (Zod TelemetryPacketSchema)
  → normalize (coerce ts, enrich status)
  → anomaly detection (static thresholds + rolling z-score)
  → write:  MongoDB (queryable log) · Cassandra (time-series) · Redis (live health + latest)
  → on breach: emit alert to Kafka(telemetry.alerts)
```
Anomaly logic lives in `services/shared/src/anomaly.js`; thresholds are the `THRESHOLDS`
table in `services/shared/src/config.js`. Fan-out to the dashboard happens downstream in
`alert-service` (via Kafka), not here.

## Endpoints
| Route | Purpose |
|-------|---------|
| `GET /healthz` | liveness |
| `GET /metrics` | Prometheus metrics (`:9101`) |

## Key env vars
`KAFKA_BROKERS`, `KAFKA_TELEMETRY_TOPIC`, `KAFKA_ALERTS_TOPIC`, `KAFKA_CONSUMER_GROUP`,
`MONGO_URI`, `MONGO_DB`, `CASSANDRA_*`, `REDIS_URL`, `HEALTH_TTL_SECONDS`.
See [`.env.example`](../../.env.example) for the full list.

## Run
```bash
npm start -w @otp/ingestion-service       # or: docker compose --profile apps up ingestion-service
```
