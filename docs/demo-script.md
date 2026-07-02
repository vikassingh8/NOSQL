# Demo Video Script & Storyboard (10–15 min)

A shot-by-shot plan for the capstone demo. Default recording target is the **local Docker stack**
($0); an optional **Azure VM** path is noted where it differs. Aim ~12 minutes.

## Pre-flight (before recording)
```bash
# Local, from repo root
cp .env.example .env            # if not already present
docker compose up -d            # datastores + Kafka + Prometheus + Grafana
npm install
npm run seed                    # seeds Mongo users/catalog, Cassandra schema, Neo4j graph
docker compose --profile apps up -d --build   # the 4 services + simulator + frontend
```
Confirm ready: `curl -s localhost:4000/healthz` → `{"status":"ok"}`, and the simulator is
publishing (ingestion logs show packets).

**Demo logins (RBAC):** `mission/mission123` (mission-ops), `scientist/science123` (scientist),
`admin/admin123` (admin).

**Windows to have open:** terminal, dashboard (http://localhost:5173 or the served frontend),
Swagger UI (http://localhost:4000/docs), Grafana (http://localhost:3001 →
*Orbital Telemetry — Overview*), Neo4j Browser (http://localhost:7474).

---

## Segment 1 — Architecture overview (~2 min)
- Open `docs/architecture/logical-architecture.svg` and `deployment-architecture.svg`.
- Talking points: real-time satellite telemetry; **four NoSQL stores, one per access pattern**
  (Mongo=documents, Redis=live health cache, Cassandra=time-series, Neo4j=fault-tree);
  **Kafka** as the ingestion backbone; microservices (ingestion / api / alert) + simulator.
- Mention the deployment model: local Docker for dev; single **ARM64 Azure VM** running the whole
  stack behind Caddy TLS, with managed Cosmos/Event Hubs/Key Vault provisioned via Terraform.

## Segment 2 — Live ingestion & multi-model storage (~3 min)
- Show the `satellite-simulator` logs publishing JSON packets to Kafka `telemetry.raw`.
- Show `ingestion-service` logs validating (Zod) and routing to Mongo + Cassandra + Redis.
- Log in and read from each store to prove the multi-model design:
```bash
TOKEN=$(curl -s localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"mission","password":"mission123"}' | jq -r .token)

curl -s localhost:4000/satellites -H "Authorization: Bearer $TOKEN"                 # Mongo + Redis
curl -s localhost:4000/satellites/SAT-01/health -H "Authorization: Bearer $TOKEN"   # Redis live health
curl -s "localhost:4000/telemetry/SAT-01/history?sensorId=SAT-01:TEMPERATURE&limit=10" \
  -H "Authorization: Bearer $TOKEN"                                                 # Cassandra time-series
curl -s "localhost:4000/telemetry/SAT-01/aggregate" -H "Authorization: Bearer $TOKEN" # Mongo aggregation
```

## Segment 3 — Alerts, ack & fault-tree impact (~3 min)
- Explain anomaly detection (`services/shared/src/anomaly.js`): static thresholds + rolling z-score;
  the simulator injects occasional out-of-range values.
- Watch a **threshold breach** flow: ingestion emits to Kafka `telemetry.alerts` → `alert-service`
  persists + broadcasts live (WebSocket/SSE) → alert appears on the dashboard.
```bash
curl -s localhost:4000/alerts -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH localhost:4000/alerts/<ALERT_ID>/ack -H "Authorization: Bearer $TOKEN"  # who/when recorded
```
- For a **critical** breach, show the recorded failure event and Neo4j impact analysis:
```bash
curl -s localhost:4000/failures -H "Authorization: Bearer $TOKEN"
curl -s localhost:4000/graph/SAT-01/impact -H "Authorization: Bearer $TOKEN"
```
- Optionally open Neo4j Browser to show the dependency graph visually.

## Segment 4 — Security & API (~1.5 min)
- Show a call **without** a token → 401; scientist calling `/failures` → **403** (RBAC).
- Show rate-limiting (rapid repeats → 429) and the Swagger UI at `/docs` (OpenAPI 3.1 contract).
- Mention JWT auth, bcrypt hashing, helmet, Zod validation, and the audit-log collection.

## Segment 5 — Monitoring & cost (~1.5 min)
- Open **Grafana → Orbital Telemetry — Overview**: ingestion rate, alert rate, API p95 latency,
  error counts. Point out the Prometheus alert rules (`monitoring/prometheus/alerts.yml`).
- Show `infra/terraform/budget.tf` + the $50 monthly budget with 80%/100% email alerts, and the
  cost strategy (`docs/cost-strategy.md`): free-first locally, single-VM in the cloud, destroy-when-idle.

## Segment 6 — IaC & CI/CD (~1 min)
- Skim `infra/terraform/` (VM + Cosmos + Event Hubs + Key Vault) and `.github/workflows/ci.yml`
  (build/test/validate + manual ARM64 build→ACR→`terraform apply` deploy job).
- (Optional, if using the Azure account) show the deployed VM URL over HTTPS via Caddy.

## Wrap (~0.5 min)
- Recap rubric coverage: 4 NoSQL models, real-time ingestion, secure API + alerts, IaC + CI/CD,
  monitoring + cost control, full documentation. Point to `docs/capstone-report.md`.

---

### Optional: Azure VM demo instead of local
Prereqs: `az login` (personal account), an ACR with ARM64 images (`image_tag`), `terraform apply`
with `deploy_vm=true`. Then browse `https://<vm-public-ip>/` (Caddy self-signed — accept the
warning), `/docs` for Swagger, and SSH-tunnel Grafana: `ssh -L 3000:localhost:3000 azureuser@<ip>`.
Tear down after recording: `terraform destroy` (returns idle cost to $0).
