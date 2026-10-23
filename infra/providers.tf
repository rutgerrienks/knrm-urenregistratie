terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    # SSO (Entra ID): uncomment samen met entra.tf en draai `terraform init -upgrade`.
    # azuread = {
    #   source  = "hashicorp/azuread"
    #   version = "~> 3.0"
    # }
  }
}

provider "azurerm" {
  subscription_id = var.subscription_id
  features {}
}

provider "random" {}

# SSO (Entra ID): uncomment samen met entra.tf.
# provider "azuread" {}
