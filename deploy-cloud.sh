#!/bin/bash

# cloud deployment script for Household Tracker
# This script build the docker image, pushes it to Docker Hub, and deploys it to Azure Container Apps.

set -e

# Variables
RESOURCE_GROUP="household-tracker-rg"
LOCATION="EastUS"
CONTAINERAPPS_ENV="household-tracker-env"
CONTAINERAPP_NAME="household-tracker-app"
DOCKERHUB_REPO="household-web-app"
DOCKERHUB_USERNAME='mielski'
IMAGE_TAG="v1.0.0"
IMAGE_NAME="$DOCKERHUB_USERNAME/$DOCKERHUB_REPO:$IMAGE_TAG"
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



# Step 1: Build the Docker image
echo "Building Docker image..."

echo $IMAGE_NAME
docker build -t $IMAGE_NAME .
if [ $? -ne 0 ]; then
    echo "Docker build failed!"
    exit 1
fi
echo "Docker image built successfully: $IMAGE_NAME"
# Step 2: Push the Docker image to Docker Hub
echo "Pushing Docker image to Docker Hub..."
docker push "$IMAGE_NAME"
if [ $? -ne 0 ]; then
    echo "Docker push failed!"
    exit 1
fi
echo "Docker image pushed successfully to Docker Hub: $IMAGE_NAME"  


# Step 3: Deploy to Azure Container Apps using Azure Developer CLI (azd)
# Make sure you have azd installed and logged in
# Also ensure Docker Desktop is running
# Check if azd is installed
if ! command -v azd &> /dev/null; then
    echo "ERROR: azd (Azure Developer CLI) is not installed. Please install it before running this script."
    exit 1
fi

echo "Application deployed successfully to Azure Container Apps."
echo "Please ensure you are using the correct Azure subscription and environment for deployment."
azd env list
azd config get subscription
read -p "Is the above subscription and environment correct? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Aborting deployment. Please configure azd with the correct subscription and environment."
    exit 1
fi

echo "azd up - Deploying to Azure Container Apps... "
azd up
if [ $? -ne 0 ]; then
    echo "azd up failed!"
    exit 1
fi
echo "Application deployed successfully to Azure Container Apps."creating automa