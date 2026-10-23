locals {
  name = var.prefix
  tags = {
    project     = "KNRM Urenregistratie"
    environment = "pilot"
    managed_by  = "terraform"
  }
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "random_password" "postgres" {
  length  = 24
  special = false
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

# ---------------- Container Registry ----------------
resource "azurerm_container_registry" "acr" {
  name                = "acr${replace(local.name, "-", "")}${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

# ---------------- PostgreSQL Flexible Server ----------------
resource "azurerm_postgresql_flexible_server" "pg" {
  name                          = "psql-${local.name}-${random_string.suffix.result}"
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = azurerm_resource_group.rg.location
  version                       = "16"
  administrator_login           = var.postgres_admin_user
  administrator_password        = random_password.postgres.result
  storage_mb                    = 32768
  sku_name                      = "B_Standard_B1ms"
  zone                          = "1"
  public_network_access_enabled = true
  tags                          = local.tags

  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "knrm"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Allow other Azure services (Container Apps egress) to reach the database.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.pg.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ---------------- Observability ----------------
resource "azurerm_log_analytics_workspace" "law" {
  name                = "log-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

# ---------------- App Service Plan (Linux, containers) ----------------
# NB: dit abonnement blokkeert Microsoft.App/containerApps via een management-group
# policy. Front- en backend draaien daarom als twee losse containers op App Service
# (Web App for Containers), elk in een eigen container maar op hetzelfde plan.
resource "azurerm_service_plan" "plan" {
  name                = "asp-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1"
  tags                = local.tags
}

locals {
  database_url = "postgresql+psycopg://${var.postgres_admin_user}:${random_password.postgres.result}@${azurerm_postgresql_flexible_server.pg.fqdn}:5432/${azurerm_postgresql_flexible_server_database.db.name}?sslmode=require"
}

# ---------------- Backend Web App (container) ----------------
resource "azurerm_linux_web_app" "backend" {
  name                = "${local.name}-backend-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id
  https_only          = true
  tags                = local.tags

  site_config {
    always_on = true
    application_stack {
      docker_image_name        = var.backend_image
      docker_registry_url      = "https://${azurerm_container_registry.acr.login_server}"
      docker_registry_username = azurerm_container_registry.acr.admin_username
      docker_registry_password = azurerm_container_registry.acr.admin_password
    }
  }

  app_settings = {
    WEBSITES_PORT                       = "8000"
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
    DATABASE_URL                        = local.database_url
    JWT_SECRET                          = var.jwt_secret
    SEED_ADMIN_EMAIL                    = var.seed_admin_email
    SEED_ADMIN_PASSWORD                 = var.seed_admin_password
    CORS_ORIGINS                        = "*"

    # SSO (Entra ID): leeg = uitgeschakeld. Vul entra_tenant_id/entra_client_id in
    # terraform.tfvars, óf uncomment entra.tf en vervang de twee regels hieronder door:
    #   ENTRA_TENANT_ID = data.azuread_client_config.current.tenant_id
    #   ENTRA_CLIENT_ID = azuread_application.sso.client_id
    ENTRA_TENANT_ID = var.entra_tenant_id
    ENTRA_CLIENT_ID = var.entra_client_id
  }
}

# ---------------- Frontend Web App (container) ----------------
resource "azurerm_linux_web_app" "frontend" {
  name                = "${local.name}-frontend-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id
  https_only          = true
  tags                = local.tags

  site_config {
    always_on = true
    application_stack {
      docker_image_name        = var.frontend_image
      docker_registry_url      = "https://${azurerm_container_registry.acr.login_server}"
      docker_registry_username = azurerm_container_registry.acr.admin_username
      docker_registry_password = azurerm_container_registry.acr.admin_password
    }
  }

  app_settings = {
    WEBSITES_PORT                       = "80"
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
    BACKEND_URL                         = "https://${azurerm_linux_web_app.backend.default_hostname}"
  }
}
