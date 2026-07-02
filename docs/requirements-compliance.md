# Requirements Compliance — Orbital Telemetry Platform

A side-by-side check of every capstone requirement against what is implemented in this
repository. ✅ = done, 🟡 = partial/optional. For the file-level map see
[`requirements-traceability.md`](requirements-traceability.md); for the narrative see
[`capstone-report.md`](capstone-report.md).

---

## Key Features

| Requirement | Status | Where |
|-------------|:------:|-------|
| Real-time ingestion & processing of telemetry/health data | ✅ | `services/ingestion-service`, `services/satellite-simulator` |
| **MongoDB** for structured telemetry logs | ✅ | `services/shared/src/db/mongo.js` |
| **Redis** for ephemeral cache / mission alerts | ✅ | `services/shared/src/db/redis.js` |
| **Cassandra** for time-series data at scale | ✅ | `services/shared/src/db/cassandra.js` |
| **Neo4j** for component dependency graphs | ✅ | `services/shared/src/db/neo4j.js` |
| Microservices-based API layer | ✅ | `services/api-service`, `alert-service`, `ingestion-service` |
| Cloud-native deployment (Azure) | ✅ | `infra/terraform/` — ARM64 VM (`vm.tf`) + managed services (Cosmos, Event Hubs, Key Vault) |
| Infrastructure as Code + CI/CD | ✅ | `infra/terraform`, `infra/bicep`, `.github/workflows/ci.yml` |
| Security (RBAC, encryption, audit logs) | ✅ | `shared/src/auth.js`, Key Vault + TLS (Caddy), `audit_logs` collection |
| Monitoring, alerting & cost tracking | ✅ | `monitoring/` (Prometheus/Grafana), App Insights, `infra/terraform/budget.tf` |

---

## Key Requirements (1–6)

| # | Requirement | Status | Evidence |
|---|-------------|:------:|----------|
| 1 | Domain-driven data modeling (satellites, sensors, telemetry, alerts, failures) | ✅ | `mongo.js`, `docs/schemas/README.md` |
| 1 | Document / Key-value / Column / Graph schemas | ✅ | Mongo · Redis · Cassandra · Neo4j (all four) |
| 2 | Cloud setup: managed DBs, replication/autoscale/sharding | ✅ | Cosmos DB Mongo API (`shard_key=satelliteId`) + Cassandra API; self-hosted stores on the VM; Event Hubs (2 partitions) |
| 3 | Ingest JSON via Kafka / streams | ✅ | Kafka (KRaft) — `shared/src/db/kafka.js`; Event Hubs (Kafka-compatible) for managed path |
| 3 | Normalize, validate, route to stores | ✅ | `ingestion-service/src/index.js` + Zod `schemas.js` |
| 3 | Anomaly detection | ✅ | `shared/src/anomaly.js` (static thresholds + z-score) |
| 4 | APIs: health, telemetry snapshots, graph deps | ✅ | `api-service/src/app.js` |
| 4 | Real-time alerts on threshold breach | ✅ | ingestion → Kafka → `alert-service` (WebSocket + SSE) |
| 4 | Token auth + rate-limiting | ✅ | JWT `auth.js`, `express-rate-limit`, `helmet` |
| 5 | IaC (Terraform/Bicep) | ✅ | `infra/terraform/*.tf`, `infra/bicep/main.bicep` |
| 5 | Secrets via Key Vault / TLS / RBAC | ✅ | Key Vault + **managed-identity runtime access**, TLS (Caddy/Event Hubs), `requireRole` |
| 6 | Monitoring (metrics, logs, dashboards) | ✅ | Prometheus + Grafana + alert rules; App Insights |
| 6 | Ingestion-failure / latency logs & alerts | ✅ | `monitoring/prometheus/alerts.yml`, metrics histograms |

---

## Project Phases (1–6)

| Phase | Deliverables | Status |
|-------|--------------|:------:|
| 1 — Discovery & NoSQL strategy | use cases, model justification, architecture, cost forecast | ✅ |
| 2 — Schema & data modeling | 4 NoSQL schemas | ✅ |
| 3 — Ingestion microservice | Kafka consumer, validation, storage, anomaly detection | ✅ |
| 4 — Cloud deployment & security | IaC, Key Vault, RBAC, TLS | ✅ |
| 5 — Analytics dashboard & alerts | REST APIs, real-time alert engine | ✅ |
| 6 — Monitoring, CI/CD, cost | metrics, dashboards, budget, pipeline | ✅ |

Full index with links: [`docs/phases/README.md`](phases/README.md).

---

## Rubric Coverage

| Category | Weight | Status | Evidence |
|----------|:------:|:------:|----------|
| Data Modeling & NoSQL Usage | 20 | ✅ | 4 stores with real read/write logic; `docs/schemas` |
| Cloud Architecture | 15 | ✅ | ARM64 VM full stack + Cosmos + Event Hubs + Key Vault; `docs/architecture` |
| Telemetry Ingestion Logic | 15 | ✅ | Kafka pipeline, Zod validation, anomaly engine (threshold-direction + z-score) |
| API & Alerts | 15 | ✅ | REST + OpenAPI/Swagger, JWT+RBAC, WS/SSE alert engine, ack endpoint |
| Infrastructure Automation | 10 | ✅ | Terraform/Bicep + CI **and** manual CD (`buildx` ARM64 → ACR → `terraform apply`) |
| Monitoring & Cost Control | 10 | ✅ | Prometheus/Grafana + alert rules, App Insights, $50 budget alerts |
| Documentation & Demo | 15 | 🟡 | Docs ✅ (report, diagrams, OpenAPI, this matrix, demo script); **demo video recording pending** |

---

## Final Submission Items

| Item | Status | Where |
|------|:------:|-------|
| Capstone report | ✅ | [`docs/capstone-report.md`](capstone-report.md) |
| NoSQL model rationale + schemas | ✅ | [`docs/schemas/README.md`](schemas/README.md) |
| Architecture diagrams (logical + deployment) | ✅ | [`docs/architecture/`](architecture/) |
| API definitions & documentation | ✅ | [`docs/api/openapi.yaml`](api/openapi.yaml) + Swagger UI `/docs` |
| IaC & monitoring setup | ✅ | `infra/`, `monitoring/` |
| Budget & cost strategy | ✅ | [`docs/cost-strategy.md`](cost-strategy.md) |
| Code repository (ingestion, alert, API microservices) | ✅ | `services/` |
| CI/CD pipeline | ✅ | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Demo storyboard/script | ✅ | [`docs/demo-script.md`](demo-script.md) |
| **Demo video (10–15 min)** | 🟡 | to be recorded (see demo script) |

**Verification:** `npm test` → 19 tests pass · `npm run lint` → 0 errors ·
`terraform validate` → valid. Azure resources are provisioned via `terraform apply` (VM model) and
**torn down when not demoing** (`terraform destroy`), keeping idle cost at **$0**.
