# satellite-simulator

Test data source. Publishes realistic JSON telemetry packets to Kafka so the rest of the
pipeline has something to ingest during local runs and demos.

- Emits 5 sensor types (temperature, battery, voltage, signal, pressure) for each
  configured satellite, once per interval.
- Injects a configurable fraction of out-of-range anomalies so alerts fire.

## Key env vars
| Var | Default | Meaning |
|-----|---------|---------|
| `SIM_SATELLITES` | `SAT-01,SAT-02,SAT-03` | satellites to simulate |
| `SIM_INTERVAL_MS` | `1000` | packet interval per satellite |
| `SIM_ANOMALY_RATE` | `0.05` | fraction of anomalous packets |
| `KAFKA_BROKERS`, `KAFKA_TELEMETRY_TOPIC` | — | Kafka target |

## Run
```bash
npm start -w @otp/satellite-simulator     # or: docker compose --profile apps up satellite-simulator
```
