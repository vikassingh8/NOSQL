# 🛰️ Orbital Telemetry Platform

A **multi-model, cloud-native NoSQL** platform that ingests real-time satellite telemetry,
processes it, stores it across **MongoDB + Redis + Cassandra + Neo4j** (via **Kafka**), and serves
analytics + real-time alerts to a mission-control dashboard.

> Capstone project. Runs **fully locally on Docker**, and deploys to **Azure** via Terraform
> (managed Cosmos DB, Redis, Event Hubs, Key Vault, App Insights + an all-in-one VM).

## Architecture at a glance

![Logical architecture](docs/architecture/logical-architecture.svg)

More diagrams: `docs/architecture/README.md` · Schemas: `docs/schemas/README.md`

## Tech stack
Node.js 22 · Express 5 · MongoDB 8 · Redis 7 · Cassandra 5 · Neo4j 5 · Kafka (KRaft) ·
Zod · JWT · Prometheus + Grafana · React 19 + Vite · Terraform + Bicep · GitHub Actions · Docker

---

## Prerequisites
- **Docker Desktop** (required)
- **Node.js 22+** and npm (for seeding + running the dashboard)

## Quick start (local)
```bash
# 1. Configure env
cp .env.example .env

# 2. Start infrastructure (databases, Kafka, Prometheus, Grafana)
npm run infra:up
#    wait ~1–2 min for Cassandra/Kafka to become healthy:  docker compose ps

# 3. Install dependencies
npm install

# 4. Seed all stores (satellites, sensors, users, graph, Cassandra schema)
npm run seed

# 5a. Run everything in Docker (services too):
docker compose --profile apps up -d --build

# 5b. ...OR run services locally in separate terminals for development:
npm run dev:ingestion
npm run dev:alert
npm run dev:api
npm run dev:sim

# 6. Run the dashboard
cd frontend && npm install && npm run dev
```

## URLs
| What | URL | Notes |
|------|-----|-------|
| Dashboard | http://localhost:5173 | login: `mission` / `mission123` |
| API | http://localhost:4000 | `/healthz`, `/metrics`, `/docs` (Swagger UI) |
| Alert service | http://localhost:4100 | `/ws/alerts`, `/alerts/stream` |
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | |
| Neo4j Browser | http://localhost:7474 | neo4j / password123 |

## Demo logins (RBAC)
| User | Password | Role |
|------|----------|------|
| mission | mission123 | mission-ops |
| scientist | science123 | scientist |
| admin | admin123 | admin |

---

## Verify it works
```bash
# Get a token
curl -s localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"mission","password":"mission123"}'

# Live health (use the token from above)
curl -s localhost:4000/satellites/SAT-01/health -H "Authorization: Bearer <TOKEN>"

# Historical time-series from Cassandra
curl -s "localhost:4000/telemetry/SAT-01/history?sensorId=SAT-01:TEMPERATURE&limit=10" \
  -H "Authorization: Bearer <TOKEN>"

# Aggregated stats per sensor type (MongoDB aggregation, last 60 min)
curl -s "localhost:4000/telemetry/SAT-01/aggregate?minutes=60" -H "Authorization: Bearer <TOKEN>"

# Fault-tree impact from Neo4j
curl -s "localhost:4000/graph/SAT-01/impact?module=PowerBus" -H "Authorization: Bearer <TOKEN>"

# Recorded failure events (logged on critical breaches)
curl -s localhost:4000/failures -H "Authorization: Bearer <TOKEN>"

# Recent alerts (the simulator injects ~5% anomalies)
curl -s localhost:4000/alerts -H "Authorization: Bearer <TOKEN>"

# Acknowledge an alert (mission-ops only) — use an _id from the /alerts response
curl -s -X PATCH localhost:4000/alerts/<ALERT_ID>/ack -H "Authorization: Bearer <TOKEN>"
```
Open Grafana → **Orbital Telemetry — Overview** to watch ingestion rate, alerts, and latency.

**Interactive API docs:** the full OpenAPI 3.1 spec lives in
[`docs/api/openapi.yaml`](docs/api/openapi.yaml) and is served as Swagger UI at
http://localhost:4000/docs (raw JSON at `/openapi.json`).

## Tests
```bash
npm test            # Vitest + Supertest (api-service)
npm run lint        # ESLint
```

## Cloud deployment (later)
```bash
cd infra/terraform
terraform init
terraform plan        # review
terraform apply       # provisions Azure resources
```
Bicep alternative in `infra/bicep/`. A consumption budget with alerts is defined in `infra/terraform/budget.tf`.

## Repository layout
```
services/        shared lib + ingestion / api / alert / simulator microservices
frontend/        React + Vite mission-control dashboard
infra/           Terraform + Bicep (Azure)
monitoring/      Prometheus + Grafana provisioning
scripts/         seed scripts (Mongo / Cassandra / Neo4j)
docs/            architecture diagrams, schemas, OpenAPI spec, phase index, demo script
```
