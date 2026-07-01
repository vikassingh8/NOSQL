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
# Neo4j runs as a container (locally and on the all-in-one VM); Neo4j Aura is the managed option.
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

  # Mongoose 8 requires wire version 8 (MongoDB 4.2+). Cosmos defaults to 3.6.
  mongo_server_version = "4.2"

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

# Telemetry collection with an explicit shard key → horizontal partitioning (sharding).
# Cosmos automatically replicates each partition 4x within the region (replication),
# and the account can be switched to autoscale/multi-region as load grows.
resource "azurerm_cosmosdb_mongo_collection" "telemetry" {
  name                = "telemetry"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.mongo.name
  database_name       = azurerm_cosmosdb_mongo_database.telemetry.name

  # Shard (partition) key — spreads writes across physical partitions by satellite.
  shard_key = "satelliteId"

  index {
    keys   = ["_id"]
    unique = true
  }
  index {
    keys = ["satelliteId", "ts"]
  }
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

# Strong JWT signing secret, generated + stored in Key Vault (never committed).
resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "azurerm_key_vault_secret" "jwt" {
  name         = "jwt-secret"
  value        = random_password.jwt.result
  key_vault_id = azurerm_key_vault.kv.id
}

# ─── Runtime identity for the microservices ───────────────────────────────────
# A user-assigned managed identity lets Container Apps pull secrets from Key Vault
# without any secret in code/env. Using a user-assigned (not system-assigned)
# identity avoids the create-order cycle between the app and the KV access policy.
resource "azurerm_user_assigned_identity" "app" {
  name                = "${local.name}-app-id"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = local.tags
}

resource "azurerm_key_vault_access_policy" "app" {
  key_vault_id       = azurerm_key_vault.kv.id
  tenant_id          = data.azurerm_client_config.current.tenant_id
  object_id          = azurerm_user_assigned_identity.app.principal_id
  secret_permissions = ["Get", "List"]
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

  # Pull secrets from Key Vault via the user-assigned managed identity.
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  secret {
    name                = "mongo-uri"
    key_vault_secret_id = azurerm_key_vault_secret.mongo_conn.id
    identity            = azurerm_user_assigned_identity.app.id
  }
  secret {
    name                = "jwt-secret"
    key_vault_secret_id = azurerm_key_vault_secret.jwt.id
    identity            = azurerm_user_assigned_identity.app.id
  }

  template {
    min_replicas = 1
    max_replicas = 3
    container {
      name   = "api"
      image  = "${var.container_registry}/otp-api-service:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name        = "MONGO_URI"
        secret_name = "mongo-uri"
      }
      env {
        name  = "MONGO_DB"
        value = azurerm_cosmosdb_mongo_database.telemetry.name
      }
      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }
      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.appi.connection_string
      }
    }
  }

  depends_on = [azurerm_key_vault_access_policy.app]

  ingress {
    external_enabled = true
    target_port      = 4000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}
