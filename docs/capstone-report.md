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
| Document | **MongoDB** | telemetry packets, catalog, alerts, users | flexible schema + rich indexed queries |
| Key-Value | **Redis** | live health, alert pub/sub, rate-limit | sub-ms reads, TTL, ephemeral |
| Wide-Column | **Cassandra** | long-term time-series | linear write scaling, partition pruning |
| Graph | **Neo4j** | component dependency / fault tree | native transitive traversal |

Messaging backbone: **Apache Kafka (KRaft)** decouples ingestion from producers and buffers bursts.
See `docs/architecture/` for diagrams.

---

## 4. Data Modeling & Schema Design
Full schemas in `docs/schemas/README.md`. Highlights:
- **MongoDB** `telemetry` indexed on `{satelliteId, ts}` and `{type, ts}`.
- **Redis** keys: `sat:{id}:health` (HASH, TTL), `sensor:{id}:latest`, pub/sub `alerts:channel`.
- **Cassandra** `telemetry_ts` partitioned by `(satellite_id, sensor_id, bucket_day)`, clustered
  `event_time DESC`.
- **Neo4j** `(:Sensor)-[:PART_OF]->(:Module)-[:PART_OF]->(:Subsystem)-[:PART_OF]->(:Satellite)`
  plus `(:Module)-[:DEPENDS_ON]->(:Module)`.

**Trade-offs:** the same reading is denormalized across three stores (storage cost traded for
per-pattern read performance); Redis/Cassandra favor availability + speed (eventual consistency).

---

## 5. Data Ingestion & Processing Pipeline
`satellite-simulator` → **Kafka `telemetry.raw`** → `ingestion-service`:
1. **Validate** each packet with Zod (drops malformed packets, increments error metric).
2. **Normalize** (timestamp parsing, status enrichment).
3. **Anomaly detection** — static operating thresholds + rolling z-score outlier check
   (`services/shared/src/anomaly.js`).
4. **Route** to MongoDB (log), Cassandra (time-series), Redis (live health + latest).
5. **Emit alerts** on breach → Kafka `telemetry.alerts` + Redis pub/sub. The alert-service
   persists each alert and records a **failure event** (`failure_events`) for every *critical*
   breach, attributed to the responsible module.

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
| `GET /failures` | recorded failure events | MongoDB |

**Security:** JWT auth, **RBAC** (`mission-ops` / `scientist` / `admin`), bcrypt password hashing,
`helmet` headers, `express-rate-limit` (429 on abuse), Zod input validation, audit-log collection.

**`alert-service`** consumes alerts, persists them, and pushes them live to the dashboard over
**WebSocket** (and SSE fallback) — real-time threshold alerting.

---

## 7. Cloud Deployment, Security & Monitoring
- **Local:** Docker Compose runs all DBs + Kafka + services + Prometheus/Grafana.
- **Azure (IaC, deploy later):** Terraform + Bicep provision Cosmos DB (Mongo + Cassandra APIs),
  Azure Cache for Redis, Container Apps, Key Vault, Log Analytics/App Insights, and a cost budget.
  Neo4j via Aura free tier.
- **Scaling:** Cosmos serverless autoscale; Container Apps replicas; Cassandra replication factor;
  Redis as a read cache.
- **Security:** secrets in Key Vault, TLS in transit, RBAC, encryption at rest (managed).
- **Monitoring:** `prom-client` metrics → Prometheus → Grafana dashboard
  (`monitoring/grafana/dashboards/telemetry-overview.json`): ingestion rate, alert rate,
  processing/API latency p95, error counts. Structured logs via pino.

---

## 8. Infrastructure Automation & CI/CD
- **IaC:** `infra/terraform/` (primary) and `infra/bicep/` (alternative), fully parameterized.
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`) — install, lint, test (Vitest/Supertest),
  build all four Docker images (matrix), and `terraform validate`.

---

## 9. Challenges, Trade-offs & Future Improvements
- **Operating four databases** — solved with a shared client library (`@otp/shared`) and a single
  Docker Compose stack.
- **Consistency vs performance** — eventual consistency accepted for live/time-series data.
- **Storage vs query efficiency** — deliberate denormalization across stores.
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
| Documentation (15) | this report + `docs/` + diagrams |
