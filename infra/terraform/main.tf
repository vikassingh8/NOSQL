# ──────────────────────────────────────────────────────────────────────────────
# Orbital Telemetry Platform — Azure infrastructure
# Provisions managed equivalents of the local stack:
#   MongoDB  → Azure Cosmos DB (MongoDB API)
#   Cassandra→ Azure Cosmos DB (Cassandra API)
#   Redis    → Azure Cache for Redis
#   Compute  → Azure Container Apps (the 4 microservices)
#   Secrets  → Azure Key Vault
#   Monitor  → Log Analytics + Application Insights
#   Cost     → Consumption budget with email alerts
# Neo4j is provisioned separately via Neo4j Aura (see docs/cost-strategy.md).
# ──────────────────────────────────────────────────────────────────────────────

locals {
  name = "${var.prefix}-${var.environment}"
  tags = {
    project     = "orbital-telemetry"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_resource_group" "rg" {
  name     = "${local.name}-rg"
  location = var.location
  tags     = local.tags
}

# ─── Cosmos DB: MongoDB API (telemetry documents) ─────────────────────────────
resource "azurerm_cosmosdb_account" "mongo" {
  name                = "${local.name}-mongo"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  offer_type          = "Standard"
  kind                = "MongoDB"

  # Free tier: first 1000 RU/s + 25 GB are free (one free-tier account per subscription).
  free_tier_enabled = true

  capabilities {
    name = "EnableMongo"
  }

  consistency_policy {
    consistency_level = "Session"
  }
  geo_location {
    location          = var.location
    failover_priority = 0
  }
  tags = local.tags
}

resource "azurerm_cosmosdb_mongo_database" "telemetry" {
  name                = "telemetry"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.mongo.name
  throughput          = 1000 # covered by the free-tier 1000 RU/s allowance → $0
}

# ─── Cosmos DB: Cassandra API (time-series) ───────────────────────────────────
resource "azurerm_cosmosdb_account" "cassandra" {
  name                = "${local.name}-cass"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  capabilities {
    name = "EnableCassandra"
  }
  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }
  geo_location {
    location          = var.location
    failover_priority = 0
  }
  tags = local.tags
}

# ─── Azure Cache for Redis (live health / alerts) ─────────────────────────────
resource "azurerm_redis_cache" "redis" {
  count               = var.deploy_redis ? 1 : 0
  name                = "${local.name}-redis"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  capacity            = 0
  family              = "C"
  sku_name            = "Basic"
  minimum_tls_version = "1.2"
  tags                = local.tags
}

# ─── Key Vault (secrets: connection strings, JWT secret) ──────────────────────
data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  # KV names are globally unique → suffix with part of the subscription id.
  name                       = "${local.name}-kv-${substr(data.azurerm_client_config.current.subscription_id, 0, 8)}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = false
  soft_delete_retention_days = 7
  rbac_authorization_enabled = false
  tags                       = local.tags

  # Grant the deploying identity permission to write the secrets below.
  access_policy {
    tenant_id          = data.azurerm_client_config.current.tenant_id
    object_id          = data.azurerm_client_config.current.object_id
    secret_permissions = ["Get", "List", "Set", "Delete", "Purge", "Recover"]
  }
}

resource "azurerm_key_vault_secret" "mongo_conn" {
  name         = "mongo-connection-string"
  value        = azurerm_cosmosdb_account.mongo.primary_mongodb_connection_string
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "redis_conn" {
  count        = var.deploy_redis ? 1 : 0
  name         = "redis-connection-string"
  value        = azurerm_redis_cache.redis[0].primary_connection_string
  key_vault_id = azurerm_key_vault.kv.id
}

# ─── Monitoring: Log Analytics + Application Insights ─────────────────────────
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${local.name}-logs"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "appi" {
  name                = "${local.name}-appi"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "Node.JS"
  tags                = local.tags
}

# ─── Container Apps environment + microservices ───────────────────────────────
resource "azurerm_container_app_environment" "env" {
  name                       = "${local.name}-cae"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = local.tags
}

# API service (externally reachable).
# Gated: only created once images are built and pushed (set deploy_container_apps = true).
resource "azurerm_container_app" "api" {
  count                        = var.deploy_container_apps ? 1 : 0
  name                         = "${local.name}-api"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"
  tags                         = local.tags

  template {
    min_replicas = 1
    max_replicas = 3
    container {
      name   = "api"
      image  = "${var.container_registry}/otp-api-service:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 4000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}
