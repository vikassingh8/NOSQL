# Project Phases — Deliverable Index

The capstone was built in the six prescribed phases. Content is organized by topic
across the repo rather than duplicated per phase; this index maps each phase to where
its deliverables live so reviewers can navigate straight to them.

| Phase | Deliverables | Where to find them |
|-------|--------------|--------------------|
| **1 — Requirement Discovery & NoSQL Strategy** | Use-case breakdown, justification for each NoSQL model, initial architecture, cost forecast | [`../capstone-report.md`](../capstone-report.md) §1–3 · [`../architecture/`](../architecture/) · [`../cost-strategy.md`](../cost-strategy.md) |
| **2 — Schema & Data Modeling** | JSON schema (Mongo), Redis key strategy, Cassandra wide-column DDL, Neo4j graph model | [`../schemas/README.md`](../schemas/README.md) · `services/shared/src/db/*` |
| **3 — Telemetry Ingestion Microservice** | Kafka consumer, validation/normalization, routing to stores, anomaly detection | [`../../services/ingestion-service/`](../../services/ingestion-service/) · `services/shared/src/anomaly.js` · [report §5](../capstone-report.md) |
| **4 — Cloud Deployment & Security** | Terraform/Bicep IaC, Key Vault, RBAC, TLS | [`../../infra/`](../../infra/) · [`../azure-deploy.md`](../azure-deploy.md) · `services/shared/src/auth.js` · [report §7](../capstone-report.md) |
| **5 — Analytics Dashboard & Alerts** | REST APIs (real-time + historical), real-time alert engine | [`../../services/api-service/`](../../services/api-service/) · [`../../services/alert-service/`](../../services/alert-service/) · [`../api/openapi.yaml`](../api/openapi.yaml) · [`../../frontend/`](../../frontend/) |
| **6 — Monitoring, CI/CD & Cost Control** | Metrics, dashboards, budget alerts, CI/CD pipeline | [`../../monitoring/`](../../monitoring/) · `infra/terraform/budget.tf` · [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) · [`../cost-strategy.md`](../cost-strategy.md) |

See [`../requirements-traceability.md`](../requirements-traceability.md) for the full
requirement→code matrix, RBAC role table, and rubric coverage.
