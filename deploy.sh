#!/usr/bin/env bash
# Deploy the KNRM urenregistratietool to Azure.
# Prereqs: az login, terraform, and an infra/terraform.tfvars (see terraform.tfvars.example).
set -euo pipefail

cd "$(dirname "$0")/infra"

echo "==> 1/4  Terraform init"
terraform init -input=false

echo "==> 2/4  Create resource group + container registry"
terraform apply -input=false -auto-approve \
  -target=azurerm_resource_group.rg \
  -target=azurerm_container_registry.acr

ACR_NAME=$(terraform output -raw acr_name)
ACR_SERVER=$(terraform output -raw acr_login_server)

echo "==> 3/4  Build & push images to ${ACR_SERVER} (via ACR cloud build)"
az acr build --registry "$ACR_NAME" --image knrm-backend:latest  ../backend
az acr build --registry "$ACR_NAME" --image knrm-frontend:latest ../frontend

echo "==> 4/4  Apply full infrastructure (Postgres + Container Apps)"
terraform apply -input=false -auto-approve

echo
echo "Klaar. Frontend: $(terraform output -raw frontend_url)"
echo "Backend:  $(terraform output -raw backend_url)"
