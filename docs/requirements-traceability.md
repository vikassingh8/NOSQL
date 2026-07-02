# Requirements Traceability Matrix

Maps each capstone requirement to where it is implemented. Use alongside `capstone-report.md`.

## Key Requirements
| Requirement | Implemented in |
|-------------|----------------|
| Domain modeling: satellites, sensors, telemetry, alerts, failure events | `services/shared/src/db/mongo.js`, `docs/schemas/README.md` |
| Document model (telemetry packets) | MongoDB — `mongo.js` `Telemetry` schema |
| Key-value model (live health) | Redis — `services/shared/src/db/redis.js` |
| Column model (time-series) | Cassandra — `services/shared/src/db/cassandra.js`, `scripts/init-cassandra.cql` |
| Graph model (fault tree) | Neo4j — `services/shared/src/db/neo4j.js`, `scripts/seed-neo4j.js` |
| Cloud deploy + replication/autoscale/sharding | `infra/terraform` (VM + Cosmos `shard_key=satelliteId` + Event Hubs), `infra/bicep`, `docs/cost-strategy.md` |
| Ingest JSON via Kafka | `services/satellite-simulator`, `services/ingestion-service`, `shared/src/db/kafka.js` |
| Validate / normalize / route | `ingestion-service/src/index.js` + `shared/src/schemas.js` |
| Anomaly detection | `services/shared/src/anomaly.js` |
| Aggregate data for dashboards | `GET /telemetry/:id/aggregate` (`api-service/src/app.js`) |
| APIs: health / snapshot / graph deps | `api-service/src/app.js` |
| Real-time alerts (threshold breach) | `ingestion-service` (emit) → `alert-service` (persist + WebSocket/SSE) |
| Token auth + rate-limiting | `shared/src/auth.js`, `helmet` + `express-rate-limit` in `app.js` |
| RBAC | `requireRole` in `shared/src/auth.js`, **enforced per-route** in `api-service/src/app.js` (see role matrix below), roles seeded in `seed-mongo.js` |
| Failure events | recorded by `alert-service` on critical (Mongo + Neo4j); exposed via `GET /failures` |
| IaC (Terraform / Bicep) | `infra/terraform/*.tf`, `infra/bicep/main.bicep` |
| Secrets (Key Vault) | `azurerm_key_vault` + secrets + managed identity in `infra/terraform/main.tf` |
| Monitoring (metrics, logs, dashboard) | `shared/src/metrics.js`, `monitoring/`, App Insights in IaC |
| Cost tracking / budget | `infra/terraform/budget.tf`, `docs/cost-strategy.md` |
| CI/CD | `.github/workflows/ci.yml` |

## RBAC role matrix
Enforced by `requireRole(...)` in `api-service/src/app.js` (the `admin` role is always allowed).

| Endpoint | mission-ops | scientist | admin |
|----------|:-----------:|:---------:|:-----:|
| `POST /auth/login` | ✓ | ✓ | ✓ |
| `GET /satellites`, `GET /satellites/:id/health` | ✓ | ✓ | ✓ |
| `GET /telemetry/:id/snapshot` · `/history` · `/aggregate` | ✓ | ✓ | ✓ |
| `GET /graph/:id` · `/graph/:id/impact` | ✓ | ✓ | ✓ |
| `GET /alerts` · `PATCH /alerts/:id/ack` | ✓ | ✗ (403) | ✓ |
| `GET /failures` | ✓ | ✗ (403) | ✓ |

## Project Phases
| Phase | Deliverables | Location |
|-------|--------------|----------|
| 1 — Discovery & NoSQL strategy | use cases, model justification, architecture, cost forecast | `docs/capstone-report.md`, `docs/architecture/`, `docs/cost-strategy.md` |
| 2 — Schema & data modeling | 4 NoSQL schemas | `docs/schemas/README.md`, `shared/src/db/*` |
| 3 — Ingestion microservice | Kafka consumer, validation, storage, anomaly detection | `ingestion-service`, `anomaly.js` |
| 4 — Cloud deployment & security | IaC, Key Vault, RBAC, TLS | `infra/`, `auth.js` |
| 5 — Analytics & alerts | REST APIs, real-time alert engine | `api-service`, `alert-service` |
| 6 — Monitoring, CI/CD, cost | metrics, dashboards, budget, pipeline | `monitoring/`, `budget.tf`, `ci.yml` |

## Rubric coverage
| Category (weight) | Evidence |
|-------------------|----------|
| Data Modeling & NoSQL (20) | `shared/src/db/*`, `docs/schemas` |
| Cloud Architecture (15) | `infra/terraform`, `infra/bicep`, `docs/architecture` |
| Telemetry Ingestion (15) | `ingestion-service`, `anomaly.js` |
| API & Alerts (15) | `api-service`, `alert-service` |
| Infrastructure Automation (10) | `infra/`, `.github/workflows/ci.yml` |
| Monitoring & Cost (10) | `monitoring/`, `docs/cost-strategy.md`, `budget.tf` |
| Documentation (15) | `docs/`, diagrams, this matrix, `docs/demo-script.md` |
