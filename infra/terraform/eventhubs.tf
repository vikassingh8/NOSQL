# ─── Azure Event Hubs (managed messaging queue) ───────────────────────────────
# Satisfies "IaC provisions messaging queues". Event Hubs exposes a Kafka-compatible
# endpoint (Standard+ tier); services can point at it via SASL (see KAFKA_SSL/SASL_*
# in shared/src/db/kafka.js). Basic tier is used here to minimise cost.
resource "azurerm_eventhub_namespace" "ehns" {
  count               = var.deploy_eventhubs ? 1 : 0
  name                = "${local.name}-ehns"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Basic"
  capacity            = 1
  tags                = local.tags
}

resource "azurerm_eventhub" "raw" {
  count             = var.deploy_eventhubs ? 1 : 0
  name              = "telemetry.raw"
  namespace_id      = azurerm_eventhub_namespace.ehns[0].id
  partition_count   = 2
  message_retention = 1
}

resource "azurerm_eventhub" "alerts" {
  count             = var.deploy_eventhubs ? 1 : 0
  name              = "telemetry.alerts"
  namespace_id      = azurerm_eventhub_namespace.ehns[0].id
  partition_count   = 2
  message_retention = 1
}
