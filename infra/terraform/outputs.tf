output "resource_group" {
  value = azurerm_resource_group.rg.name
}

output "mongo_database" {
  value = azurerm_cosmosdb_mongo_database.telemetry.name
}

output "redis_hostname" {
  value = var.deploy_redis ? azurerm_redis_cache.redis[0].hostname : "not-deployed"
}

output "key_vault_uri" {
  value = azurerm_key_vault.kv.vault_uri
}

output "api_url" {
  value = var.deploy_container_apps ? "https://${azurerm_container_app.api[0].ingress[0].fqdn}" : "not-deployed (set deploy_container_apps=true after pushing images)"
}

output "app_insights_connection_string" {
  value     = azurerm_application_insights.appi.connection_string
  sensitive = true
}
