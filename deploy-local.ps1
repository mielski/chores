# Local deployment script for Household Tracker (PowerShell)
# This script builds and runs the application locally using Docker

param(
    [switch]$Clean = $false
)

Write-Host "🏠 Household Tracker - Local Deployment" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Clean up if requested
if ($Clean) {
    Write-Host "🧹 Cleaning up existing resources..." -ForegroundColor Yellow
    docker stop household-tracker 2>$null
    docker rm household-tracker 2>$null
    docker rmi household-tracker:latest 2>$null
    docker volume rm household-data 2>$null
}

# Build the Docker image
Write-Host "🔨 Building Docker image..." -ForegroundColor Blue
docker build -t household-tracker:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build Docker image" -ForegroundColor Red
    exit 1
}

# Stop any existing container
Write-Host "🛑 Stopping any existing containers..." -ForegroundColor Yellow
docker stop household-tracker 2>$null
docker rm household-tracker 2>$null

# Create a volume for persistent data storage
Write-Host "💾 Creating Docker volume for data persistence..." -ForegroundColor Blue
docker volume create household-data 2>$null

# Run the container
Write-Host "🚀 Starting the application..." -ForegroundColor Green
docker run -d `
    --name household-tracker `
    -p 8080:8080 `
    -v household-data:/app/data `
    -e DEBUG=true `
    household-tracker:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start the application" -ForegroundColor Red
    exit 1
}

# Wait for the application to start
Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
Start-Sleep 5

# Check if the application is running
$running = docker ps --filter "name=household-tracker" --format "table {{.Names}}" | Select-String "household-tracker"

if ($running) {
    Write-Host "✅ Application started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Access your application at: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "📊 Health check: http://localhost:8080/api/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 To view logs: docker logs household-tracker -f" -ForegroundColor Yellow
    Write-Host "🛑 To stop: docker stop household-tracker" -ForegroundColor Yellow
    Write-Host "🗑️  To clean up: docker rm household-tracker; docker volume rm household-data" -ForegroundColor Yellow
    
    # Try to open browser
    try {
        Start-Process "http://localhost:8080"
    } catch {
        Write-Host "ℹ️  Could not automatically open browser" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Failed to start the application" -ForegroundColor Red
    Write-Host "📝 Check logs with: docker logs household-tracker" -ForegroundColor Yellow
    exit 1
}
