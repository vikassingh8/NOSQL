# Capstone Report — Orbital Telemetry Platform
### A Multi-Model, Cloud-Native NoSQL Satellite Telemetry Data Platform

---

## 1. Overview
The Orbital Telemetry Platform ingests real-time satellite sensor data, processes and stores it
across four purpose-chosen NoSQL databases, and serves analytics + alerts to mission control teams
and scientists. It is built for **scalability, low-latency reads/writes, security, and fault
tolerance** — the demands of mission-critical space systems.

- **Data nature:** real-time, high-volume, semi-structured streaming telemetry (temperature,
  battery, voltage, signal, pressure) from multiple satellites.
- **Why NoSQL:** no single database optimally serves flexible documents, sub-ms lookups,
  high-throughput time-series, *and* graph traversal. A multi-model approach uses the right tool
  for each access pattern.

---

## 2. Problem Understanding & Requirements
**Functional:** ingest telemetry → validate/normalize → store → query (live + historical) →
detect anomalies → alert → visualize.

**Non-functional:** scalability (sharding/replication), low latency (Redis live state),
fault tolerance (Kafka buffering, Cassandra replication), security (JWT/RBAC/TLS/secrets),
observability (metrics, logs, dashboards).

**Why relational alone is insufficient:** rigid schemas struggle with heterogeneous sensor
payloads; single-node write throughput caps time-series ingestion; recursive dependency queries
("what fails if module X fails?") are expensive in SQL but native to a graph DB.

---

## 3. Multi-Model NoSQL Architecture
| Model | Database | Handles | Why |
|-------|----------|---------|-----|
| Document | **MongoDB** | telemetry packets, catalog, alerts, users, audit | flexible schema + rich indexed queries |
| Key-Value | **Redis** | live health, latest snapshots, alert cache | sub-ms reads, TTL, ephemeral |
| Wide-Column | **Cassandra** | long-term time-series | linear write scaling, partition pruning |
| Graph | **Neo4j** | component dependency / fault tree | native transitive traversal |

Messaging backbone: **Apache Kafka (KRaft)** decouples ingestion from producers and buffers bursts.
See `docs/architecture/` for the logical, deployment, and data-flow diagrams.

---

## 4. Data Modeling & Schema Design
Full schemas in `docs/schemas/README.md`. Highlights:
- **MongoDB** `telemetry` indexed on `{satelliteId, ts}` and `{type, ts}`; plus `satellites`,
  `sensors`, `alerts` (with `acknowledged`/`ackedBy`/`ackedAt`), `failure_events`, `users`
  (bcrypt hash + role), and an `audit_logs` collection.
- **Redis** keys: `sat:{id}:health` (HASH, TTL), `sensor:{id}:latest` (latest reading),
  `sat:{id}:alerts` (capped LIST of recent alerts, TTL), `satellites:all` (SET). Redis is used
  strictly as an ephemeral TTL cache — **live alert fan-out to clients is done over WebSocket/SSE,
  not Redis pub/sub.**
- **Cassandra** `telemetry_ts` partitioned by `(satellite_id, sensor_id, bucket_day)`, clustered
  `event_time DESC`.
- **Neo4j** `(:Module)-[:PART_OF]->(:Subsystem)-[:PART_OF]->(:Satellite)` plus
  `(:Module)-[:DEPENDS_ON]->(:Module)` and `(:FailureEvent)-[:AFFECTS]->(:Module)`.

**Trade-offs:** the same reading is denormalized across three stores (storage cost traded for
per-pattern read performance); Redis/Cassandra favor availability + speed (eventual consistency).

---

## 5. Data Ingestion & Processing Pipeline
`satellite-simulator` → **Kafka `telemetry.raw`** → `ingestion-service`:
1. **Validate** each packet with Zod (drops malformed packets, increments error metric).
2. **Normalize** (timestamp parsing, status enrichment).
3. **Anomaly detection** — static operating thresholds + a rolling z-score outlier check
   (`services/shared/src/anomaly.js`). Threshold direction is inferred so low-side breaches
   (battery/voltage/signal) flag correctly.
4. **Route** to MongoDB (log), Cassandra (time-series), Redis (live health + latest).
5. **Emit alerts** on breach → Kafka `telemetry.alerts`. The `alert-service` persists each alert,
   caches it in Redis, and for every *critical* breach records a **failure event**
   (`failure_events` in Mongo + `(:FailureEvent)-[:AFFECTS]->(:Module)` in Neo4j), attributed to
   the responsible module.

Kafka provides buffering and at-least-once delivery, so ingestion survives downstream slowness.

---

## 6. API Layer, Alerts & Access
**`api-service` (Express 5)** exposes:
| Endpoint | Purpose | Source |
|----------|---------|--------|
| `POST /auth/login` | JWT issue | MongoDB users |
| `GET /satellites` | catalog + live list | Mongo + Redis |
| `GET /satellites/:id/health` | live health | Redis |
| `GET /telemetry/:id/snapshot` | recent packets | MongoDB |
| `GET /telemetry/:id/history` | historical series | Cassandra |
| `GET /telemetry/:id/aggregate` | windowed avg/min/max per type | MongoDB aggregation |
| `GET /graph/:id` / `/graph/:id/impact` | dependency / fault-tree | Neo4j |
| `GET /alerts` | recent alerts | MongoDB |
| `PATCH /alerts/:id/ack` | acknowledge an alert (records who/when) | MongoDB |
| `GET /failures` | recorded failure events | MongoDB |

The full contract is documented as an **OpenAPI 3.1 spec** (`docs/api/openapi.yaml`), served
interactively via Swagger UI at `/docs`.

**Security:** JWT auth, **RBAC** (`mission-ops` / `scientist` / `admin`), bcrypt password hashing,
`helmet` headers, `express-rate-limit` (429 on abuse), Zod input validation, audit-log collection.

**`alert-service`** consumes `telemetry.alerts`, persists each alert, caches it in Redis, records
critical failures to Mongo + Neo4j, and pushes alerts live to the dashboard over **WebSocket**
(with an **SSE** fallback) — real-time threshold alerting.

---

## 7. Cloud Deployment, Security & Monitoring
Two deployment models are provided; **the VM model is what `terraform.tfvars` actually deploys.**

- **Local:** Docker Compose runs all DBs + Kafka + the four services + Prometheus/Grafana for $0.
- **Azure — all-in-one VM (primary, `infra/terraform/vm.tf`):** a single ARM64 VM
  (`Standard_B2ps_v2`, Ampere) runs the full stack from `infra/vm/docker-compose.cloud.yml.tftpl`
  — self-hosted MongoDB, Redis, Cassandra, Neo4j, Kafka (KRaft), the four services, the frontend,
  and Prometheus + Grafana, all behind a **Caddy** TLS reverse proxy. App images are pulled from
  **Azure Container Registry** (ARM64). `cloud-init` handles Docker install, ACR login, and
  `docker compose up`.
- **Azure — managed services (provisioned alongside):** Terraform also provisions **Cosmos DB**
  (MongoDB API with `shard_key = satelliteId`, and Cassandra API), **Azure Event Hubs** (Kafka-
  compatible `telemetry.raw` / `telemetry.alerts`), **Key Vault** (+ user-assigned managed
  identity for secret access), **Log Analytics / Application Insights**, and a **cost budget**.
  A **Container Apps** deployment and **Azure Cache for Redis** are defined but gated off by
  default to save cost. The `@otp/shared` clients support both self-hosted and managed endpoints
  (TLS + SASL for Event Hubs / Cosmos Cassandra) via config.
- **Security:** secrets in Key Vault (JWT secret generated via `random_password`, never committed),
  TLS in transit (Caddy on the VM; TLS 1.2 + SASL for managed endpoints), RBAC, encryption at rest
  (Azure-managed), audit-log collection, and fail-fast config that refuses dev-default secrets in
  production.
- **Monitoring:** `prom-client` metrics → Prometheus → Grafana dashboard
  (`monitoring/grafana/dashboards/telemetry-overview.json`): ingestion rate, alert rate,
  processing/API latency p95, error counts. Alert rules in `monitoring/prometheus/alerts.yml`
  (ingestion stalled, high error rate, p95 latency, alert surge, target down). Azure-native
  telemetry via Application Insights.

---

## 8. Infrastructure Automation & CI/CD
- **IaC:** `infra/terraform/` (authoritative, holds live state) and `infra/bicep/` (a smaller
  ARM-native reference), fully parameterized via `terraform.tfvars` toggles
  (`deploy_vm`, `deploy_eventhubs`, `deploy_container_apps`, `deploy_redis`).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — install, lint, test (Vitest/Supertest,
  **19 tests**), build all four Docker images (matrix), and `terraform fmt`/`validate`.
- **CD (manual):** a `workflow_dispatch` `deploy` job logs in to Azure + ACR, builds and pushes
  **ARM64** images with `docker buildx`, and runs `terraform apply` for the VM model. It is
  manual-trigger only to avoid surprise Azure spend.

---

## 9. Challenges, Trade-offs & Future Improvements
- **Operating four databases** — solved with a shared client library (`@otp/shared`) and a single
  Docker Compose stack.
- **Consistency vs performance** — eventual consistency accepted for live/time-series data.
- **Storage vs query efficiency** — deliberate denormalization across stores.
- **ARM64-only subscription** — images must be built for `linux/arm64`; handled via buildx in CD.
- **Future:** schema registry for Kafka, tiered TTL on Cassandra, ML-based anomaly detection,
  multi-region replication, and per-tenant API quotas.

---

## 10. Rubric Mapping
| Rubric Category | Where addressed |
|-----------------|-----------------|
| Data Modeling & NoSQL (20) | §3–4, `docs/schemas`, `services/shared/src/db/*` |
| Cloud Architecture (15) | §7, `infra/terraform`, `infra/bicep` |
| Telemetry Ingestion (15) | §5, `ingestion-service`, `anomaly.js` |
| API & Alerts (15) | §6, `api-service`, `alert-service` |
| Infrastructure Automation (10) | §8, `infra/`, `.github/workflows/ci.yml` |
| Monitoring & Cost (10) | §7, `monitoring/`, `docs/cost-strategy.md` |
| Documentation (15) | this report + `docs/` + diagrams + `docs/demo-script.md` |
