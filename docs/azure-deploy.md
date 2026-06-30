# Azure Deployment (Free-Tier)

Deploys the managed data + monitoring layer to Azure using **free / near-zero** services.
Designed for an Azure **free trial** ($200 credit) — the headline resource (Cosmos DB MongoDB API)
runs on the **free tier** ($0).

## What gets deployed (free-tier plan)
| Resource | Tier | Cost |
|----------|------|------|
| Resource Group | — | $0 |
| Cosmos DB (MongoDB API) + database | **Free tier** (1000 RU/s + 25 GB) | **$0** |
| Cosmos DB (Cassandra API) | Serverless (pay-per-request) | ~$0 idle |
| Key Vault + secret | Standard | <$1 |
| Log Analytics + App Insights | Pay-as-you-go (5 GB free) | $0 in free grant |
| Container Apps environment | Consumption | $0 idle |
| Consumption budget alert | — | $0 |

**Skipped to stay free:** Azure Cache for Redis (Basic C0 ≈ $16/mo). Enable with
`-var="deploy_redis=true"` if you want it (uses trial credit).
**Gated:** the microservice Container App — enable with `-var="deploy_container_apps=true"`
*after* building and pushing images (see below).

## Prerequisites
- Azure CLI logged in: `az login`
- Terraform ≥ 1.9

## Deploy
```bash
cd infra/terraform
terraform init
terraform plan  -var="deploy_redis=false" -out=tfplan
terraform apply tfplan          # ~10–20 min (Cosmos accounts are slow to provision)
terraform output               # connection info
```

> Note: `apply` creates a Key Vault access policy (an IAM change), so run it from a shell where
> your Azure CLI is logged in, e.g.:
> `terraform -chdir=infra/terraform apply tfplan`

## Run the services against Azure (optional, next step)
The four microservices run locally by default. To run them **in Azure** too:
```bash
# 1. Create a container registry and push images
az acr create -g otp-dev-rg -n <youracr> --sku Basic
az acr login -n <youracr>
for s in api-service ingestion-service alert-service satellite-simulator; do
  docker build -f services/$s/Dockerfile -t <youracr>.azurecr.io/otp-$s:latest .
  docker push <youracr>.azurecr.io/otp-$s:latest
done

# 2. Re-apply with container apps enabled
terraform apply \
  -var="deploy_container_apps=true" \
  -var="container_registry=<youracr>.azurecr.io"
```

## Tear down (stop all spend)
```bash
terraform destroy -var="deploy_redis=false"
```
This deletes everything in `otp-dev-rg`.

## Cost safety
- `budget.tf` emails you at 80% actual / 100% forecast of the monthly budget (default $50).
- Run `terraform destroy` whenever you're not demoing.
- See `docs/cost-strategy.md` for the full strategy.
