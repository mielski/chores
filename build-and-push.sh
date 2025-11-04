#!/usr/bin/env bash
# Build and push Docker image with commit-sha and latest tags.
# Usage: ./scripts/build-and-push.sh
# Optional env vars (can be set in .env): DOCKERHUB_USERNAME, DOCKERHUB_REPO
# Optional: to automatically update a Container App to the new :latest image after push,
# set AZ_RESOURCE_GROUP and CONTAINER_APP_NAME (requires az CLI logged in and permission).

set -euo pipefail


REPO="mielski/household-web-app"

# Determine short git SHA
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  SHORT_SHA=$(git rev-parse --short=7 HEAD)
else
  echo "Warning: not in a git repo; falling back to timestamp tag"
  SHORT_SHA=$(date +%Y%m%d%H%M%S)
fi


COMMIT_TAG="$REPO:$SHORT_SHA"
LATEST_TAG="$REPO:latest"

echo "Building tags:"
echo "  commit: $COMMIT_TAG"
echo "  latest: $LATEST_TAG"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker CLI not found"
  exit 1
fi

# Build and push commit-tag
echo "Building image ($COMMIT_TAG)"
docker build -t "$COMMIT_TAG" .

echo "Pushing $COMMIT_TAG"
docker push "$COMMIT_TAG"

echo "Tagging as latest and pushing"
docker tag "$COMMIT_TAG" "$LATEST_TAG"
docker push "$LATEST_TAG"

echo "Image pushed: $COMMIT_TAG and $LATEST_TAG"

# echo "If you want the Container App to pick up :latest automatically, set AZ_RESOURCE_GROUP and CONTAINER_APP_NAME and ensure 'az' is logged in."

# Optional: update Container App to force pull latest (if AZ vars provided)
# if [[ -n "${AZ_RESOURCE_GROUP:-}" && -n "${CONTAINER_APP_NAME:-}" ]]; then
#   if command -v az >/dev/null 2>&1; then
#     echo "Updating Container App $CONTAINER_APP_NAME in $AZ_RESOURCE_GROUP to use $LATEST_TAG"
#     az containerapp update --name "$CONTAINER_APP_NAME" --resource-group "$AZ_RESOURCE_GROUP" --image "$LATEST_TAG"
#     echo "Container App update requested (this will create a new revision using the latest image)."
#   else
#     echo "az CLI not found; skipping Container App update."
#   fi
# fi

# Output the tags for downstream automation
echo "$COMMIT_TAG" > .last_image_tag || true
echo "$LATEST_TAG" > .last_image_latest || true

exit 0
