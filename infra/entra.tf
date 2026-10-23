# ---------------- SSO: Microsoft Entra ID app registration (optioneel) ----------------
#
# Dit bestand maakt — na uncommenten — de Entra ID app registration aan voor SSO
# (frontend: MSAL.js authorization code + PKCE; backend: POST /api/auth/sso).
#
# Inschakelen:
#   1. Uncomment in providers.tf de azuread-provider (required_providers + provider-blok).
#   2. Uncomment alle resources en outputs hieronder.
#   3. Vervang in main.tf (backend app_settings) de twee ENTRA_*-regels door de
#      varianten die daar in de comment staan.
#   4. Draai: terraform init -upgrade && terraform apply
#      NB: vereist rechten om app registrations aan te maken in de tenant
#      (rol "Application Developer" of hoger).
#
# Alternatief zonder dit bestand: maak de app registration handmatig aan in de portal
# (SPA-platform, redirect URI = frontend-URL) en vul entra_tenant_id/entra_client_id
# in terraform.tfvars.

# data "azuread_client_config" "current" {}
#
# resource "azuread_application" "sso" {
#   display_name     = "${local.name}-sso"
#   sign_in_audience = "AzureADMyOrg"
#   owners           = [data.azuread_client_config.current.object_id]
#
#   single_page_application {
#     # NB: opgebouwd uit naam + suffix i.p.v. een verwijzing naar
#     # azurerm_linux_web_app.frontend, om een dependency-cycle te voorkomen
#     # (frontend -> backend -> app registration -> frontend).
#     redirect_uris = [
#       "https://${local.name}-frontend-${random_string.suffix.result}.azurewebsites.net/",
#       "http://localhost:5173/", # lokale ontwikkeling (Vite)
#     ]
#   }
#
#   # id_token bevat e-mailclaims voor de mapping op het lokale account.
#   required_resource_access {
#     resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph
#     resource_access {
#       id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d" # User.Read (delegated)
#       type = "Scope"
#     }
#   }
# }
#
# resource "azuread_service_principal" "sso" {
#   client_id = azuread_application.sso.client_id
# }
#
# output "entra_tenant_id" {
#   value       = data.azuread_client_config.current.tenant_id
#   description = "Tenant ID voor de frontend (MSAL) en backend (ENTRA_TENANT_ID)."
# }
#
# output "entra_client_id" {
#   value       = azuread_application.sso.client_id
#   description = "Client ID voor de frontend (MSAL) en backend (ENTRA_CLIENT_ID)."
# }
