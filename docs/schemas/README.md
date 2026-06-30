# Phase 2 — Schema & Data Modeling

Four NoSQL models, each chosen for the access pattern it serves best.

---

## 1. MongoDB (Document) — telemetry packets & catalog

**Why:** telemetry packets are semi-structured JSON whose fields vary by sensor type. A
document store gives schema flexibility plus rich secondary-index queries.

### Collection `telemetry`
```json
{
  "_id": "ObjectId",
  "satelliteId": "SAT-01",
  "sensorId": "SAT-01:TEMPERATURE",
  "type": "temperature",
  "value": 84.2,
  "unit": "C",
  "status": "WARNING",
  "ts": "2026-06-29T10:00:00.000Z",
  "meta": { "orbit": "LEO", "fw": "1.4.2" }
}
```
Indexes: `{ satelliteId: 1, ts: -1 }`, `{ type: 1, ts: -1 }`.

### Other collections
| Collection | Purpose | Key fields |
|-----------|---------|-----------|
| `satellites` | catalog | `_id`, name, orbit, status |
| `sensors` | catalog | `_id` (`SAT:TYPE`), satelliteId, type, unit, module |
| `alerts` | persisted alerts | satelliteId, severity, message, acknowledged, ts |
| `failure_events` | logged failures | satelliteId, module, cause, ts |
| `users` | auth + RBAC | username, passwordHash, role |
| `audit_logs` | API audit trail | username, action, path, ts |

---

## 2. Redis (Key-Value) — live health, alerts, rate-limit

**Why:** sub-millisecond reads for "current state" + ephemeral TTL data. Not a system of record.

| Key | Type | Contents | TTL |
|-----|------|----------|-----|
| `sat:{id}:health` | HASH | `{ temperature, battery, ..., status, lastSeen }` | 120s |
| `sensor:{id}:latest` | STRING (JSON) | last full packet | 120s |
| `satellites:all` | SET | known satellite ids | — |
| `alerts:channel` | Pub/Sub | live alert fan-out to alert-service | — |
| `ratelimit:{ip}` | counter | express-rate-limit window | window |

---

## 3. Cassandra (Wide-Column) — long-term time-series

**Why:** append-heavy, massive time-series; linear write scaling; partition pruning by day.

```sql
CREATE TABLE telemetry_ts (
  satellite_id text, sensor_id text, bucket_day date,
  event_time timestamp, type text, value double, unit text, status text,
  PRIMARY KEY ((satellite_id, sensor_id, bucket_day), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);
```
- **Partition key** `(satellite_id, sensor_id, bucket_day)` keeps partitions bounded to one
  sensor-day (prevents unbounded partitions).
- **Clustering** `event_time DESC` → "latest N readings" is a sequential read.

---

## 4. Neo4j (Graph) — component dependency / fault tree

**Why:** "if module X fails, what is impacted?" is a transitive traversal — native to graphs.

**Nodes:** `Satellite`, `Subsystem`, `Module`, `Sensor`, `FailureEvent`
**Relationships:**
```
(Sensor)-[:PART_OF]->(Module)-[:PART_OF]->(Subsystem)-[:PART_OF]->(Satellite)
(Module)-[:DEPENDS_ON]->(Module)
(FailureEvent)-[:AFFECTS]->(Module)
```
Impact query (used by `/graph/:id/impact`):
```cypher
MATCH (failed:Module {name:$m})-[:PART_OF*0..]->(:Satellite {id:$sat})
OPTIONAL MATCH (affected:Module)-[:DEPENDS_ON*1..]->(failed)
RETURN failed.name, collect(DISTINCT affected.name) AS affectedModules
```

---

## Trade-offs
- **Denormalization:** the same reading is written to Mongo (queryable log), Cassandra
  (time-series), and Redis (latest) — storage cost traded for read performance per access pattern.
- **Consistency:** Cassandra/Redis favor availability + speed (eventual) over strong consistency;
  acceptable for telemetry where the latest value matters most.
