#!/bin/bash

# Local deployment script for Household Tracker
# This script builds and runs the application locally using Docker

set -e

echo "🏠 Household Tracker - Local Deployment"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t household-tracker:latest .

# Stop any existing container
echo "🛑 Stopping any existing containers..."
docker stop household-tracker 2>/dev/null || true
docker rm household-tracker 2>/dev/null || true

# Create a volume for persistent data storage
echo "💾 Creating Docker volume for data persistence..."
docker volume create household-data || true

# Run the container
echo "🚀 Starting the application..."
docker run -d \
    --name household-tracker \
    -p 8080:8080 \
    -v household-data:/app/data \
    -e DEBUG=true \
    household-tracker:latest

# Wait for the application to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check if the application is running
if docker ps | grep -q household-tracker; then
    echo "✅ Application started successfully!"
    echo ""
    echo "🌐 Access your application at: http://localhost:8080"
    echo "📊 Health check: http://localhost:8080/api/health"
    echo ""
    echo "📝 To view logs: docker logs household-tracker -f"
    echo "🛑 To stop: docker stop household-tracker"
    echo "🗑️  To clean up: docker rm household-tracker && docker volume rm household-data"
else
    echo "❌ Failed to start the application"
    echo "📝 Check logs with: docker logs household-tracker"
    exit 1
fi
