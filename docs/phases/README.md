# Project Phases

The project was built in the six prescribed phases. This table maps each phase to where
its deliverables live in the repo.

| Phase | Deliverables | Where to find them |
|-------|--------------|--------------------|
| **1 — Requirement Discovery & NoSQL Strategy** | Use-case breakdown, justification for each NoSQL model, initial architecture | [`../architecture/`](../architecture/) |
| **2 — Schema & Data Modeling** | JSON schema (Mongo), Redis key strategy, Cassandra wide-column DDL, Neo4j graph model | [`../schemas/README.md`](../schemas/README.md) · `services/shared/src/db/*` |
| **3 — Telemetry Ingestion Microservice** | Kafka consumer, validation/normalization, routing to stores, anomaly detection | [`../../services/ingestion-service/`](../../services/ingestion-service/) · `services/shared/src/anomaly.js` |
| **4 — Cloud Deployment & Security** | Terraform/Bicep IaC, Key Vault, RBAC, TLS | [`../../infra/`](../../infra/) · `services/shared/src/auth.js` |
| **5 — Analytics Dashboard & Alerts** | REST APIs (real-time + historical), real-time alert engine | [`../../services/api-service/`](../../services/api-service/) · [`../../services/alert-service/`](../../services/alert-service/) · [`../api/openapi.yaml`](../api/openapi.yaml) · [`../../frontend/`](../../frontend/) |
| **6 — Monitoring, CI/CD & Cost Control** | Metrics, dashboards, budget alerts, CI/CD pipeline | [`../../monitoring/`](../../monitoring/) · `infra/terraform/budget.tf` · [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
