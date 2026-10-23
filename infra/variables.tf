variable "subscription_id" {
  type        = string
  description = "Azure subscription ID to deploy into."
}

variable "location" {
  type        = string
  default     = "westeurope"
  description = "Azure region for the resource group, ACR and database."
}

variable "prefix" {
  type        = string
  default     = "knrm-uren"
  description = "Name prefix for resources."
}

variable "backend_image" {
  type        = string
  default     = "knrm-backend:latest"
  description = "Backend image (repository:tag) inside the ACR."
}

variable "frontend_image" {
  type        = string
  default     = "knrm-frontend:latest"
  description = "Frontend image (repository:tag) inside the ACR."
}

variable "postgres_admin_user" {
  type    = string
  default = "knrmadmin"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT signing secret for the backend."
}

variable "seed_admin_email" {
  type    = string
  default = "beheer@knrm.nl"
}

variable "seed_admin_password" {
  type        = string
  sensitive   = true
  description = "Initial admin password seeded on first startup."
}

# ---------------- SSO: Microsoft Entra ID (optioneel) ----------------
# Leeg laten = SSO uitgeschakeld (het backend-endpoint /api/auth/sso antwoordt dan 503).
# Vul beide waarden in terraform.tfvars in na het aanmaken van een app registration,
# of gebruik entra.tf (uncommenten) om de app registration via Terraform aan te maken.
variable "entra_tenant_id" {
  type        = string
  default     = ""
  description = "Entra ID (Azure AD) tenant ID voor SSO. Leeg = SSO uit."
}

variable "entra_client_id" {
  type        = string
  default     = ""
  description = "Client ID van de Entra ID app registration voor SSO. Leeg = SSO uit."
}
