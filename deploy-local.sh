#!/bin/bash

# Local deployment script for Household Tracker
# This script builds and runs the application locally using Docker Compose

set -e

echo "🏠 Household Tracker - Local Deployment"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
echo "✅ Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose and try again."
    exit 1
fi
echo "✅ Docker Compose is available"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "📝 Please edit the .env file with your actual values before running again."
        echo "   Required variables: SECRET, USERNAME, PASSWORD"
        exit 1
    else
        echo "❌ .env.example file not found. Please create a .env file with required variables."
        exit 1
    fi
fi

# Parse command line arguments
CLEAN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--clean]"
            exit 1
            ;;
    esac
done

# Clean up if requested
if [ "$CLEAN" = true ]; then
    echo "🧹 Cleaning up existing resources..."
    docker-compose down --volumes --remove-orphans || true
    docker-compose rm -f || true
fi

# Build and start the application
echo "� Building and starting the application..."
docker-compose up --build -d

# Wait for the application to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check if the application is running
if docker-compose ps | grep -q "household-tracker.*Up"; then
    echo "✅ Application started successfully!"
    echo ""
    echo "🌐 Access your application at: http://localhost:8080"
    echo "📊 Health check: http://localhost:8080/api/health"
    echo ""
    echo "📝 To view logs: docker-compose logs -f"
    echo "🛑 To stop: docker-compose down"
    echo "🗑️  To clean up completely: docker-compose down --volumes"
    
    # Try to open browser (Linux/macOS)
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:8080 2>/dev/null || true
    elif command -v open &> /dev/null; then
        open http://localhost:8080 2>/dev/null || true
    fi
else
    echo "❌ Failed to start the application"
    echo "📝 Check logs with: docker-compose logs"
    echo "📝 Check status with: docker-compose ps"
    exit 1
fi
