# Cloud Cost Strategy & Governance

## Principle: free-first, single-VM-second
The platform runs **fully locally on Docker for $0**. For a cloud demo it is deployed to a
**single ARM64 VM** running the whole stack, which is far cheaper than a fleet of managed
databases and can be torn down between demos.

## Estimated monthly cost (dev/demo tier, Azure)

### Deployed model — all-in-one VM (`deploy_vm=true`)
| Service | Tier | Est. cost (USD/mo) |
|---------|------|--------------------|
| Linux VM (full stack) | `Standard_B2ps_v2` ARM64, 2 vCPU / 8 GB | ~$30 (only when running) |
| Managed disk + public IP | Standard | ~$3 |
| Azure Event Hubs | Basic (2 partitions) | ~$11 |
| Log Analytics + App Insights | Pay-as-you-go (5 GB free) | $0–5 |
| Key Vault | Standard | <$1 |
| **Total (VM up 24/7)** | | **~$45–50/mo** |
| **Total (VM off / torn down)** | | **~$0** |

### Managed-services alternative (gated off by default)
| Service | Tier | Est. cost (USD/mo) |
|---------|------|--------------------|
| Cosmos DB (Mongo API) | Serverless | $0–8 (pay per RU/storage) |
| Cosmos DB (Cassandra API) | Serverless | $0–8 |
| Azure Cache for Redis | Basic C0 | ~$16 |
| Container Apps | Consumption (scale-to-zero) | $0–10 |

> Set `monthly_budget` in `infra/terraform/variables.tf` (default **$50**). The
> `azurerm_consumption_budget_resource_group` fires email alerts at 80% actual / 100% forecast to
> the addresses in `alert_emails`.

## Cost controls implemented
- **Single VM over a managed fleet** — one billable compute resource instead of several managed DBs.
- **Stop/destroy when idle** — `terraform destroy` (or deallocating the VM) drops idle cost to ~$0;
  the whole stack redeploys from ACR images via `cloud-init`.
- **Serverless Cosmos DB** (managed path) — no provisioned throughput; pay only for requests.
- **Container Apps scale-to-zero** (managed path) — `min_replicas` can be 0 for non-critical services.
- **Budget + alerts** (Terraform `budget.tf`) — proactive notification before overrun.
- **Short log retention** (30 days) to cap Log Analytics ingestion cost.
- **TTL on Redis** keys — ephemeral data auto-expires, no storage creep.
- **Cassandra day-bucket partitions** — enables cheap TTL/expiry of old time-series.

## Cost monitoring
- Azure Cost Management + Budgets dashboard.
- Tag everything (`project`, `environment`, `managed_by`) for cost allocation.
- `terraform destroy` tears down everything when not demoing.
