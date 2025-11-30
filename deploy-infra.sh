#!/usr/bin/env bash
# Deploy infra (Bicep) to an Azure resource group. Use this to deploy or redeploy infra.
# Usage: ./scripts/deploy-infra.sh -g <resource-group> [-i <imageName>] [-e <environmentName>] [--restart]
# If you pass --restart (or set RESTART_CONTAINERAPP=1) and provide CONTAINER_APP_NAME, the script will update the Container App image to force a new revision.

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 -g <resource-group> [-i <imageName>] [-e <environmentName>] [--restart]
  -g <resource-group>    Resource group to deploy to (defaults to rg-dev-chores)
  -i <imageName>         Image name to set in the template (defaults to mielski/household-web-app:latest)
  -e <environmentName>   environmentName parameter for bicep (defaults to 'dev')
  --restart              After deployment, update the Container App image to force a new revision (requires CONTAINER_APP_NAME env or param)

Environment variables respected: DOCKERHUB_USERNAME, DOCKERHUB_REPO, CONTAINER_APP_NAME
EOF
}

RESOURCE_GROUP="rg-dev-chores"
IMAGE_NAME=""
ENVIRONMENT_NAME="dev"
DO_RESTART=0

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    -g) RESOURCE_GROUP="$2"; shift 2;;
    -i) IMAGE_NAME="$2"; shift 2;;
    -e) ENVIRONMENT_NAME="$2"; shift 2;;
    --restart) DO_RESTART=1; shift 1;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

# Load .env if present
if [ -f .env ]; then
  echo "Loading .env file..."
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [[ -z "${IMAGE_NAME:-}" ]]; then
  # default to repo:latest
  DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME:-mielski}
  DOCKERHUB_REPO=${DOCKERHUB_REPO:-household-web-app}
  if [[ "$DOCKERHUB_REPO" == */* ]]; then
    IMAGE_NAME="$DOCKERHUB_REPO:latest"
  else
    IMAGE_NAME="$DOCKERHUB_USERNAME/$DOCKERHUB_REPO:latest"
  fi
fi

echo "Deploying infra to resource group: $RESOURCE_GROUP"
echo "Using imageName parameter: $IMAGE_NAME"

# Validate then deploy
az deployment group validate -g "$RESOURCE_GROUP" --template-file infra/main.bicep --parameters imageName="$IMAGE_NAME" environmentName="$ENVIRONMENT_NAME"

az deployment group create -g "$RESOURCE_GROUP" --template-file infra/main.bicep --parameters imageName="$IMAGE_NAME" environmentName="$ENVIRONMENT_NAME"

# Optionally force Container App to create a revision using the provided image (restart via update)
if [[ $DO_RESTART -eq 1 || "${RESTART_CONTAINERAPP:-}" == "1" ]]; then
  if [[ -z "${CONTAINER_APP_NAME:-}" ]]; then
    echo "CONTAINER_APP_NAME not set; cannot restart container app."
  else
    if command -v az >/dev/null 2>&1; then
      echo "Updating Container App $CONTAINER_APP_NAME to image $IMAGE_NAME (forces new revision)"
      az containerapp update --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --image "$IMAGE_NAME"
      echo "Container App update requested."
    else
      echo "az CLI not found; cannot restart Container App"
    fi
  fi
fi

exit 0
