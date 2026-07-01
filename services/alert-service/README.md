# alert-service

Phase 5 real-time alert engine. Consumes threshold/anomaly alerts from Kafka, persists
them, records critical breaches as failure events (Mongo **and** Neo4j graph), and pushes
alerts live to the dashboard.

## Flow
```
Kafka(telemetry.alerts)
  → persist Alert (Mongo)
  → if critical: FailureEvent (Mongo) + (FailureEvent)-[:AFFECTS]->(Module) (Neo4j)
  → broadcast live over WebSocket (/ws/alerts) + SSE (/alerts/stream)
```
The sensor-type → responsible-module mapping (`TYPE_TO_MODULE`) mirrors the Neo4j topology.

## Endpoints
| Route | Purpose |
|-------|---------|
| `GET /alerts` | recent alerts (Mongo) |
| `GET /alerts/stream` | SSE live stream |
| `WS /ws/alerts` | WebSocket live stream |
| `GET /healthz`, `/metrics` | ops |

## Key env vars
`ALERT_PORT` (4100), `KAFKA_BROKERS`, `KAFKA_ALERTS_TOPIC`, `MONGO_URI`, `NEO4J_*`.

## Run
```bash
npm start -w @otp/alert-service
```
