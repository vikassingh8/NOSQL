# ──────────────────────────────────────────────────────────────────────────────
# All-in-one compute host (Phase 4: VMs + VPCs).
# A Linux VM in its own VNet/subnet runs the full docker-compose stack (all four
# datastores + Kafka + the four microservices + dashboard + TLS gateway) using the
# prebuilt images from ACR. Gated by var.deploy_vm.
# ──────────────────────────────────────────────────────────────────────────────

data "azurerm_container_registry" "acr" {
  count               = var.deploy_vm ? 1 : 0
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
}

resource "random_password" "vm_admin" {
  count   = var.deploy_vm ? 1 : 0
  length  = 24
  special = true
}

resource "random_password" "neo4j" {
  count   = var.deploy_vm ? 1 : 0
  length  = 20
  special = false
}

# ─── Network (VPC) ────────────────────────────────────────────────────────────
resource "azurerm_virtual_network" "vnet" {
  count               = var.deploy_vm ? 1 : 0
  name                = "${local.name}-vnet"
  address_space       = ["10.10.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = local.tags
}

resource "azurerm_subnet" "subnet" {
  count                = var.deploy_vm ? 1 : 0
  name                 = "${local.name}-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet[0].name
  address_prefixes     = ["10.10.1.0/24"]
}

resource "azurerm_network_security_group" "nsg" {
  count               = var.deploy_vm ? 1 : 0
  name                = "${local.name}-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = local.tags

  dynamic "security_rule" {
    for_each = {
      SSH       = { priority = 100, port = "22" }
      HTTP      = { priority = 110, port = "80" }
      HTTPS     = { priority = 120, port = "443" }
      API       = { priority = 130, port = "4000" }
      Neo4jHTTP = { priority = 140, port = "7474" }
      Neo4jBolt = { priority = 150, port = "7687" }
    }
    content {
      name                       = security_rule.key
      priority                   = security_rule.value.priority
      direction                  = "Inbound"
      access                     = "Allow"
      protocol                   = "Tcp"
      source_port_range          = "*"
      destination_port_range     = security_rule.value.port
      source_address_prefix      = "*"
      destination_address_prefix = "*"
    }
  }
}

resource "azurerm_subnet_network_security_group_association" "assoc" {
  count                     = var.deploy_vm ? 1 : 0
  subnet_id                 = azurerm_subnet.subnet[0].id
  network_security_group_id = azurerm_network_security_group.nsg[0].id
}

resource "azurerm_public_ip" "pip" {
  count               = var.deploy_vm ? 1 : 0
  name                = "${local.name}-pip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.tags
}

resource "azurerm_network_interface" "nic" {
  count               = var.deploy_vm ? 1 : 0
  name                = "${local.name}-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = local.tags

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.subnet[0].id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.pip[0].id
  }
}

# ─── The VM ───────────────────────────────────────────────────────────────────
resource "azurerm_linux_virtual_machine" "vm" {
  count                           = var.deploy_vm ? 1 : 0
  name                            = "${local.name}-vm"
  resource_group_name             = azurerm_resource_group.rg.name
  location                        = azurerm_resource_group.rg.location
  size                            = var.vm_size
  admin_username                  = var.vm_admin_username
  admin_password                  = random_password.vm_admin[0].result
  disable_password_authentication = false
  network_interface_ids           = [azurerm_network_interface.nic[0].id]
  tags                            = local.tags

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 64
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/../vm/cloud-init.yaml.tftpl", {
    acr          = data.azurerm_container_registry.acr[0].login_server
    acr_user     = data.azurerm_container_registry.acr[0].admin_username
    acr_pass_b64 = base64encode(data.azurerm_container_registry.acr[0].admin_password)
    compose_b64 = base64encode(templatefile("${path.module}/../vm/docker-compose.cloud.yml.tftpl", {
      acr            = data.azurerm_container_registry.acr[0].login_server
      tag            = var.image_tag
      neo4j_password = random_password.neo4j[0].result
      jwt_secret     = random_password.jwt.result
      appi           = azurerm_application_insights.appi.connection_string
    }))
    caddy_b64 = base64encode(templatefile("${path.module}/../vm/Caddyfile.tftpl", {
      public_ip = azurerm_public_ip.pip[0].ip_address
    }))
  }))
}
