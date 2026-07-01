// Orbital Telemetry Platform — Azure infra (Bicep REFERENCE alternative).
//
// NOTE: Terraform (infra/terraform/) is the authoritative, deployed IaC stack — it holds
// the live state and is what CI/CD applies. This Bicep file is a smaller ARM-native
// reference showing the same core resources; it intentionally omits the budget, Key Vault
// secrets/identity, mongo database, and Container App wiring present in Terraform. Use
// Terraform for real deployments.
//
// Deploy into an existing resource group:
//   az group create -n otp-dev-rg -l eastus
//   az deployment group create -g otp-dev-rg -f infra/bicep/main.bicep

@description('Resource name prefix')
param prefix string = 'otp'

@description('Environment tag')
param environment string = 'dev'

@description('Azure region')
param location string = resourceGroup().location

var name = '${prefix}-${environment}'
var tags = {
  project: 'orbital-telemetry'
  environment: environment
  managedBy: 'bicep'
}

// ─── Cosmos DB: MongoDB API ───────────────────────────────────────────────────
resource mongo 'Microsoft.DocumentDB/databaseAccounts@2024-08-15' = {
  name: '${name}-mongo'
  location: location
  kind: 'MongoDB'
  tags: tags
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableMongo' }
      { name: 'EnableServerless' }
    ]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [ { locationName: location, failoverPriority: 0 } ]
  }
}

// ─── Cosmos DB: Cassandra API ─────────────────────────────────────────────────
resource cassandra 'Microsoft.DocumentDB/databaseAccounts@2024-08-15' = {
  name: '${name}-cass'
  location: location
  kind: 'GlobalDocumentDB'
  tags: tags
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableCassandra' }
      { name: 'EnableServerless' }
    ]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [ { locationName: location, failoverPriority: 0 } ]
  }
}

// ─── Azure Cache for Redis ────────────────────────────────────────────────────
resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: '${name}-redis'
  location: location
  tags: tags
  properties: {
    sku: { name: 'Basic', family: 'C', capacity: 0 }
    minimumTlsVersion: '1.2'
  }
}

// ─── Log Analytics + App Insights ─────────────────────────────────────────────
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-appi'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ─── Key Vault ────────────────────────────────────────────────────────────────
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${name}-kv'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 7
  }
}

// ─── Container Apps environment ───────────────────────────────────────────────
resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-cae'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

output redisHost string = redis.properties.hostName
output keyVaultUri string = kv.properties.vaultUri
output appInsightsConnectionString string = appi.properties.ConnectionString
