#!/bin/bash

# cloud deployment script for Household Tracker
# This script build the docker image, pushes it to Docker Hub, and deploys it to Azure Container Apps.

# Use stricter bash options and fewer hard-coded tags up-front
set -euo pipefail

# Variables (can be overridden by env or .env)
# AZ_RESOURCE_GROUP can come from the environment (or from .azure/dev/.env below)
RESOURCE_GROUP="${AZ_RESOURCE_GROUP:-}"
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

    #!/usr/bin/env bash

    # Convenience wrapper for historical "deploy-cloud.sh" behavior.
    # Use the new scripts in ./scripts/ instead:
    #  - ./scripts/build-and-push.sh    # builds and pushes commit-sha + latest
    #  - ./scripts/deploy-infra.sh     # validates and deploys infra (bicep)

    set -euo pipefail

    echo "This repository now provides two focused scripts under ./scripts/"
    echo
    echo "To build and push the image (commit-sha + latest):"
    echo "  ./scripts/build-and-push.sh"
    echo
    echo "To deploy or redeploy the infrastructure (bicep):"
    echo "  ./scripts/deploy-infra.sh -g <resource-group> [-i <imageName>]"
    echo
    echo "If you want the build step to optionally update your live Container App to the new :latest image,"
    echo "set AZ_RESOURCE_GROUP and CONTAINER_APP_NAME in your environment or .env before running" 
    echo "./scripts/build-and-push.sh."

    exit 0