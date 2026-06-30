variable "prefix" {
  description = "Resource name prefix"
  type        = string
  default     = "otp"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "environment" {
  description = "Deployment environment tag"
  type        = string
  default     = "dev"
}

variable "monthly_budget" {
  description = "Monthly budget (USD) for the cost alert"
  type        = number
  default     = 50
}

variable "alert_emails" {
  description = "Emails to notify on budget threshold"
  type        = list(string)
  default     = ["vikassingh.dnagrowth@gmail.com"]
}

variable "container_registry" {
  description = "Container registry/namespace hosting the service images"
  type        = string
  default     = "ghcr.io/orbital-telemetry"
}

variable "image_tag" {
  description = "Image tag to deploy"
  type        = string
  default     = "latest"
}

variable "deploy_container_apps" {
  description = "Deploy the microservices as Container Apps (requires images pushed to the registry first)"
  type        = bool
  default     = false
}

variable "deploy_redis" {
  description = "Deploy Azure Cache for Redis (Basic C0 is not free — ~\\$16/mo against trial credit)"
  type        = bool
  default     = true
}
