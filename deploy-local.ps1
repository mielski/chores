# Local deployment script for Household Tracker (PowerShell)
# This script builds and runs the application locally using Docker Compose

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

# Check if docker-compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not available. Please install Docker Compose and try again." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Copying from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "📝 Please edit the .env file with your actual values before running again." -ForegroundColor Yellow
        Write-Host "   Required variables: SECRET, USERNAME, PASSWORD" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "❌ .env.example file not found. Please create a .env file with required variables." -ForegroundColor Red
        exit 1
    }
}

# Clean up if requested
if ($Clean) {
    Write-Host "🧹 Cleaning up existing resources..." -ForegroundColor Yellow
    docker-compose down --volumes --remove-orphans
    docker-compose rm -f
}

# Build and start the application
Write-Host "� Building and starting the application..." -ForegroundColor Blue
docker-compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start the application" -ForegroundColor Red
    Write-Host "📝 Check logs with: docker-compose logs" -ForegroundColor Yellow
    exit 1
}

# Wait for the application to start
Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
Start-Sleep 5

# Check if the application is running
$running = docker-compose ps --services --filter "status=running" | Select-String "household-tracker"

if ($running) {
    Write-Host "✅ Application started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Access your application at: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "📊 Health check: http://localhost:8080/api/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 To view logs: docker-compose logs -f" -ForegroundColor Yellow
    Write-Host "🛑 To stop: docker-compose down" -ForegroundColor Yellow
    Write-Host "🗑️  To clean up completely: docker-compose down --volumes" -ForegroundColor Yellow
    
    # Try to open browser
    try {
        Start-Process "http://localhost:8080"
    } catch {
        Write-Host "ℹ️  Could not automatically open browser" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Failed to start the application" -ForegroundColor Red
    Write-Host "📝 Check logs with: docker-compose logs" -ForegroundColor Yellow
    Write-Host "📝 Check status with: docker-compose ps" -ForegroundColor Yellow
    exit 1
}
