# api-service

Phase 5 query/API layer (Express 5). Serves mission-control reads across all four stores
behind JWT auth + RBAC + rate-limiting.

## Endpoints
Full contract: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml), served as Swagger UI
at `/docs` (raw JSON at `/openapi.json`).

| Route | Roles | Source |
|-------|-------|--------|
| `POST /auth/login` | public | Mongo users |
| `GET /satellites` | any | Mongo + Redis |
| `GET /satellites/:id/health` | any | Redis |
| `GET /telemetry/:id/snapshot` | scientist, mission-ops | Mongo |
| `GET /telemetry/:id/history` | scientist, mission-ops | Cassandra |
| `GET /telemetry/:id/aggregate` | scientist, mission-ops | Mongo aggregation |
| `GET /graph/:id`, `/graph/:id/impact` | scientist, mission-ops | Neo4j |
| `GET /failures` | mission-ops | Mongo |
| `GET /alerts` | mission-ops | Mongo |
| `PATCH /alerts/:id/ack` | mission-ops | Mongo |
| `GET /healthz`, `/metrics`, `/docs` | public | — |

`admin` bypasses all role checks.

## Security
JWT (`services/shared/src/auth.js`), bcrypt password check, `helmet`, `cors`,
`express-rate-limit`, Zod validation, audit-log middleware → Mongo `audit_logs`.

## Key env vars
`API_PORT` (4000), `JWT_SECRET`, `JWT_EXPIRES_IN`, `RATE_LIMIT_WINDOW_MS`,
`RATE_LIMIT_MAX`, `MONGO_URI`, `REDIS_URL`, `CASSANDRA_*`, `NEO4J_*`.

## Run
```bash
npm start -w @otp/api-service     # tests: npm test -w @otp/api-service
```
