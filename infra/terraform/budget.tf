# Monthly cost guardrail — emails when actual/forecast spend crosses thresholds.
resource "azurerm_consumption_budget_resource_group" "budget" {
  name              = "${local.name}-budget"
  resource_group_id = azurerm_resource_group.rg.id

  amount     = var.monthly_budget
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", timestamp())
  }

  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"
    contact_emails = var.alert_emails
  }

  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Forecasted"
    contact_emails = var.alert_emails
  }

  lifecycle {
    ignore_changes = [time_period]
  }
}
