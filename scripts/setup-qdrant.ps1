# Qdrant Setup Script (PowerShell)
# Starts Qdrant vector database using Docker

Write-Host "🚀 Setting up Qdrant Vector Database..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Check if Qdrant container already exists
$existingContainer = docker ps -a --format '{{.Names}}' | Select-String -Pattern '^qdrant$'

if ($existingContainer) {
    Write-Host "📦 Qdrant container already exists" -ForegroundColor Yellow
    
    # Check if it's running
    $runningContainer = docker ps --format '{{.Names}}' | Select-String -Pattern '^qdrant$'
    
    if ($runningContainer) {
        Write-Host "✅ Qdrant is already running on http://localhost:6333" -ForegroundColor Green
    } else {
        Write-Host "▶️  Starting existing Qdrant container..." -ForegroundColor Yellow
        docker start qdrant
        Write-Host "✅ Qdrant started on http://localhost:6333" -ForegroundColor Green
    }
} else {
    Write-Host "📥 Pulling Qdrant image..." -ForegroundColor Cyan
    docker pull qdrant/qdrant:latest
    
    Write-Host "🏃 Starting Qdrant container..." -ForegroundColor Cyan
    docker run -d `
        --name qdrant `
        -p 6333:6333 `
        -p 6334:6334 `
        -v qdrant_storage:/qdrant/storage `
        qdrant/qdrant:latest
    
    Write-Host "✅ Qdrant started on http://localhost:6333" -ForegroundColor Green
}

# Wait for Qdrant to be ready
Write-Host "⏳ Waiting for Qdrant to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:6333/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Qdrant is healthy and ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Qdrant Dashboard: http://localhost:6333/dashboard" -ForegroundColor Cyan
    Write-Host "🔌 API Endpoint: http://localhost:6333" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Qdrant may not be ready yet. Please wait a few seconds and check:" -ForegroundColor Yellow
    Write-Host "   Invoke-WebRequest http://localhost:6333/health" -ForegroundColor Gray
}

Write-Host ""
Write-Host "To stop Qdrant:" -ForegroundColor Cyan
Write-Host "  docker stop qdrant" -ForegroundColor Gray
Write-Host ""
Write-Host "To remove Qdrant:" -ForegroundColor Cyan
Write-Host "  docker rm qdrant" -ForegroundColor Gray
Write-Host "  docker volume rm qdrant_storage" -ForegroundColor Gray
