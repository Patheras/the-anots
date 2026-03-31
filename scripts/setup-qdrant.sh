#!/bin/bash

# Qdrant Setup Script
# Starts Qdrant vector database using Docker

echo "🚀 Setting up Qdrant Vector Database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# Check if Qdrant container already exists
if docker ps -a --format '{{.Names}}' | grep -q '^qdrant$'; then
  echo "📦 Qdrant container already exists"
  
  # Check if it's running
  if docker ps --format '{{.Names}}' | grep -q '^qdrant$'; then
    echo "✅ Qdrant is already running on http://localhost:6333"
  else
    echo "▶️  Starting existing Qdrant container..."
    docker start qdrant
    echo "✅ Qdrant started on http://localhost:6333"
  fi
else
  echo "📥 Pulling Qdrant image..."
  docker pull qdrant/qdrant:latest
  
  echo "🏃 Starting Qdrant container..."
  docker run -d \
    --name qdrant \
    -p 6333:6333 \
    -p 6334:6334 \
    -v qdrant_storage:/qdrant/storage \
    qdrant/qdrant:latest
  
  echo "✅ Qdrant started on http://localhost:6333"
fi

# Wait for Qdrant to be ready
echo "⏳ Waiting for Qdrant to be ready..."
sleep 3

# Check health
if curl -s http://localhost:6333/health > /dev/null 2>&1; then
  echo "✅ Qdrant is healthy and ready!"
  echo ""
  echo "📊 Qdrant Dashboard: http://localhost:6333/dashboard"
  echo "🔌 API Endpoint: http://localhost:6333"
else
  echo "⚠️  Qdrant may not be ready yet. Please wait a few seconds and check:"
  echo "   curl http://localhost:6333/health"
fi

echo ""
echo "To stop Qdrant:"
echo "  docker stop qdrant"
echo ""
echo "To remove Qdrant:"
echo "  docker rm qdrant"
echo "  docker volume rm qdrant_storage"
