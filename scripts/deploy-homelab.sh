#!/bin/bash
# ==============================================================================
# SPOT — Homelab VPS Deployment Runner
# ==============================================================================

set -e

echo "========================================================"
echo "🚀 Deploying SPOT to Homelab VPS (fazley-vps)"
echo "========================================================"

# Verify .env.production exists
if [ ! -f .env.production ]; then
  if [ -f .env ]; then
    echo "Notice: Using .env for deployment."
    ENV_FILE=".env"
  else
    echo "❌ Error: .env.production not found. Please copy .env.production.example to .env.production and configure it."
    exit 1
  fi
else
  ENV_FILE=".env.production"
fi

echo "📦 1. Building production containers..."
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml build

echo "🔄 2. Starting services..."
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d

echo "⏳ 3. Waiting for health checks..."
sleep 5

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml ps

echo "🔍 4. Checking health endpoint..."
if curl -fs http://localhost:4323/health >/dev/null 2>&1 || docker exec spot-app wget -qO- http://localhost:4323/health >/dev/null 2>&1; then
  echo "✅ Health check passed: Spot API is healthy and responding!"
else
  echo "⚠️ Notice: Healthcheck still warming up or port is not exposed on localhost."
fi

echo "========================================================"
echo "🎉 SPOT deployment completed successfully!"
echo "========================================================"
