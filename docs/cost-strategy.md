# Cloud Cost Strategy & Governance

## Principle: free-first, serverless-second
The platform runs **fully locally on Docker for $0**. Cloud is optional and provisioned
serverless/consumption-tier to keep idle cost near zero.

## Estimated monthly cost (dev/demo tier, Azure)
| Service | Tier | Est. cost (USD/mo) |
|---------|------|--------------------|
| Cosmos DB (Mongo API) | Serverless | $0–8 (pay per RU/storage) |
| Cosmos DB (Cassandra API) | Serverless | $0–8 |
| Azure Cache for Redis | Basic C0 | ~$16 |
| Container Apps | Consumption (scale-to-zero) | $0–10 |
| Log Analytics + App Insights | Pay-as-you-go (5 GB free) | $0–5 |
| Key Vault | Standard | <$1 |
| Neo4j Aura | Free tier | $0 |
| **Total** | | **~$15–50/mo** |

> Set `monthly_budget` in `infra/terraform/variables.tf` (default **$50**). The
> `azurerm_consumption_budget_resource_group` fires email alerts at 80% actual / 100% forecast.

## Cost controls implemented
- **Serverless Cosmos DB** — no provisioned throughput; pay only for requests.
- **Container Apps scale-to-zero** — `min_replicas` can be 0 for non-critical services.
- **Budget + alerts** (Terraform `budget.tf`) — proactive notification before overrun.
- **Short log retention** (30 days) to cap Log Analytics ingestion cost.
- **TTL on Redis** keys — ephemeral data auto-expires, no storage creep.
- **Cassandra day-bucket partitions** — enables cheap TTL/expiry of old time-series.

## Cost monitoring
- Azure Cost Management + Budgets dashboard.
- Tag everything (`project`, `environment`, `managed_by`) for cost allocation.
- `terraform destroy` tears down everything when not demoing.
