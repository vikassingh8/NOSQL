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

output "eventhubs_namespace" {
  value = var.deploy_eventhubs ? azurerm_eventhub_namespace.ehns[0].name : "not-deployed"
}

output "vm_dashboard_url" {
  value = var.deploy_vm ? "https://${azurerm_public_ip.pip[0].ip_address}" : "not-deployed (set deploy_vm=true)"
}

output "vm_public_ip" {
  value = var.deploy_vm ? azurerm_public_ip.pip[0].ip_address : "not-deployed"
}

output "vm_admin_username" {
  value = var.deploy_vm ? var.vm_admin_username : "not-deployed"
}

output "vm_admin_password" {
  value     = var.deploy_vm ? random_password.vm_admin[0].result : "not-deployed"
  sensitive = true
}

output "vm_neo4j_password" {
  value     = var.deploy_vm ? random_password.neo4j[0].result : "not-deployed"
  sensitive = true
}
