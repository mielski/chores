#!/bin/bash

# cloud deployment script for Household Tracker
# This script build the docker image, pushes it to Docker Hub, and deploys it to Azure Container Apps.

# Use stricter bash options and fewer hard-coded tags up-front
set -euo pipefail

# Variables (can be overridden by env or .env)
# RESOURCE_GROUP can come from the environment (or from .azure/dev/.env below)
RESOURCE_GROUP="${RESOURCE_GROUP:-}"
DOCKERHUB_REPO="household-web-app"
DOCKERHUB_USERNAME='mielski'
# Load `.env` if present (allows hiding values during local runs). The script prefers
# real environment variables (useful for CI); if none are set it will fall back to
# variables defined in `.env` (e.g. DOCKERHUB_USERNAME) or a safe placeholder.
if [ -f .env ]; then
    echo "Loading .env file..."
    # Export all variables from .env into the environment for the script
    set -o allexport
    # shellcheck disable=SC1091
    source .env
    set +o allexport
fi

# If RESOURCE_GROUP not set in the environment, try to read it from .azure/dev/.env
if [ -z "${RESOURCE_GROUP:-}" ]; then
    echo "RESOURCE_GROUP not set. Exit."
    exit 1

    # if [ -f .azure/dev/.env ]; then
    #     # strip optional surrounding quotes
    #     RG_FROM_AZD=$(grep -E '^AZURE_RESOURCE_GROUP=' .azure/dev/.env | head -n1 | cut -d= -f2- | sed 's/^"//;s/"$//') || true
    # fi
    # RESOURCE_GROUP="${RG_FROM_AZD:-household-tracker-rg}"
fi

echo "Using resource group: $RESOURCE_GROUP"


# Step 1: Build and push Docker image to Docker Hub
echo "Starting Docker build and push process..."

# Get a short commit SHA (7 chars). If git is not available, fall back to timestamp.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    SHORT_SHA=$(git rev-parse --short=7 HEAD)
    echo "Git short SHA: $SHORT_SHA"
else
    echo "Warning: not in a git repo or git not available. Using timestamp fallback for tag."
    SHORT_SHA=$(date +%Y%m%d%H%M%S)
fi

# Compute repository path (allows DOCKERHUB_REPO to be 'user/repo' or just 'repo')
if [[ "$DOCKERHUB_REPO" == */* ]]; then
    REPO="$DOCKERHUB_REPO"
else
    REPO="$DOCKERHUB_USERNAME/$DOCKERHUB_REPO"
fi

COMMIT_TAG="$REPO:$SHORT_SHA"
LATEST_TAG="$REPO:latest"

echo "Will build and push the following tags:"
echo "  commit: $COMMIT_TAG"
echo "  latest: $LATEST_TAG"

# Check docker CLI
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker CLI not found. Please install Docker and authenticate (docker login) if pushing to Docker Hub."
    exit 1
fi

echo "Building Docker image ($COMMIT_TAG)..."
docker build -t "$COMMIT_TAG" .
echo "Built: $COMMIT_TAG"

echo "Pushing commit-tagged image to Docker Hub..."
docker push "$COMMIT_TAG"
echo "Pushed: $COMMIT_TAG"

echo "Tagging image as latest and pushing..."
docker tag "$COMMIT_TAG" "$LATEST_TAG"
docker push "$LATEST_TAG"
echo "Pushed: $LATEST_TAG"

echo "Build/push complete. To deploy a specific image, pass $COMMIT_TAG into your deployment (or use the digest)."


# Step 2: Deploy to Azure Container Apps using Azure Developer CLI (azd)
# Make sure you have azd installed and logged in
# Also ensure Docker Desktop is running
echo "About to deploy infrastructure (Bicep) into resource group: $RESOURCE_GROUP"

# Ensure Azure CLI logged in and the resource group exists (create if missing)
if ! az account show >/dev/null 2>&1; then
    echo "You must be logged into Azure (az login). Aborting."
    exit 1
fi

if [ "$(az group exists --name "$RESOURCE_GROUP")" != "true" ]; then
    echo "Resource group '$RESOURCE_GROUP' does not exist. Creating with location ${AZURE_LOCATION:-westeurope}..."
    az group create --name "$RESOURCE_GROUP" --location "${AZURE_LOCATION:-westeurope}"
fi

echo "Deploying Bicep template to resource group $RESOURCE_GROUP..."
# Pass parameters from environment; imageName intentionally left to default (latest) per user's request
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters environmentName="${AZURE_ENV_NAME:-dev}"

echo "Bicep deployment finished. If you pushed a new image and want to update the running Container App directly, you can run:\n  az containerapp update --name <app-name> --resource-group $RESOURCE_GROUP --image <your-image>"