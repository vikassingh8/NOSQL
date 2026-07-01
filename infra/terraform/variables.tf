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

variable "deploy_vm" {
  description = "Deploy a Linux VM (+ VNet/NSG) running the full stack via docker-compose"
  type        = bool
  default     = false
}

variable "vm_size" {
  description = "VM size for the all-in-one compute host"
  type        = string
  default     = "Standard_B2s"
}

variable "vm_admin_username" {
  description = "Admin username for the Linux VM"
  type        = string
  default     = "azureuser"
}

variable "acr_name" {
  description = "Name of the existing Azure Container Registry holding the service images"
  type        = string
  default     = "otpdevacr594"
}
variable "deploy_eventhubs" {
  description = "Provision Azure Event Hubs (managed messaging queue) via IaC"
  type        = bool
  default     = true
}
