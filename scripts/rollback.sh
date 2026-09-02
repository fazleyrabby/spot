#!/bin/bash
# ==============================================================================
# SPOT — Instant Rollback Tool for Homelab VPS
# ==============================================================================
# Supports:
# 1. Instant Docker App Rollback (reverts to previous container image in <2s)
# 2. Git Commit Rollback (checks out previous commit & rebuilds)
# 3. Database Snapshot Rollback (restores previous PostgreSQL backup)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# Verify .env.production exists
if [ -f .env.production ]; then
  ENV_FILE=".env.production"
elif [ -f .env ]; then
  ENV_FILE=".env"
else
  echo "❌ Error: Neither .env.production nor .env found."
  exit 1
fi

show_help() {
  echo "========================================================"
  echo "⏪ SPOT VPS Rollback Utility"
  echo "========================================================"
  echo "Usage:"
  echo "  ./scripts/rollback.sh app               # Fast rollback to previous Docker image (<2s)"
  echo "  ./scripts/rollback.sh git [commit_sha]  # Roll back to specific or previous Git commit"
  echo "  ./scripts/rollback.sh db [backup_file]  # Restore PostgreSQL from backup snapshot"
  echo "  ./scripts/rollback.sh full              # Rollback both app image and latest DB snapshot"
  echo "========================================================"
}

rollback_app_image() {
  echo "========================================================"
  echo "⏪ 1. Rolling back application to previous Docker image..."
  echo "========================================================"

  if ! docker image inspect spot-spot-app:previous >/dev/null 2>&1; then
    echo "⚠️ Notice: 'spot-spot-app:previous' image tag not found."
    echo "Falling back to Git-based rebuild of previous commit (HEAD~1)..."
    rollback_git_commit "HEAD~1"
    return
  fi

  echo "🔄 Swapping spot-spot-app:previous -> spot-spot-app:latest..."
  docker tag spot-spot-app:previous spot-spot-app:latest

  echo "🚀 Restarting container with rolled-back image..."
  docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d --no-build spot-app

  sleep 3
  echo "🔍 Checking health of rolled back container..."
  if docker exec spot-app wget -qO- http://localhost:4323/health >/dev/null 2>&1; then
    echo "✅ Success! Application successfully rolled back and healthy!"
  else
    echo "⚠️ Warning: Container started, but healthcheck is still warming up."
  fi
}

rollback_git_commit() {
  local TARGET_COMMIT="${1:-HEAD~1}"
  echo "========================================================"
  echo "⏪ Rolling back Git repository to: $TARGET_COMMIT"
  echo "========================================================"

  CURRENT_COMMIT=$(git rev-parse --short HEAD)
  echo "Current commit: $CURRENT_COMMIT"

  git checkout "$TARGET_COMMIT"
  NEW_COMMIT=$(git rev-parse --short HEAD)
  echo "Checked out: $NEW_COMMIT"

  echo "📦 Rebuilding and redeploying target commit..."
  ./scripts/deploy-homelab.sh
}

rollback_db() {
  local BACKUP_TARGET="${1:-}"
  echo "========================================================"
  echo "⏪ Restoring PostgreSQL Database..."
  echo "========================================================"
  if [ -n "$BACKUP_TARGET" ]; then
    ./scripts/restore-postgres.sh "$BACKUP_TARGET"
  else
    ./scripts/restore-postgres.sh
  fi
}

# Main Command Dispatch
ACTION="${1:-app}"

case "$ACTION" in
  app)
    rollback_app_image
    ;;
  git)
    rollback_git_commit "${2:-HEAD~1}"
    ;;
  db)
    rollback_db "${2:-}"
    ;;
  full)
    echo "🚨 Full Rollback requested (App Image + Database Snapshot)"
    rollback_app_image
    rollback_db
    ;;
  --help|-h)
    show_help
    exit 0
    ;;
  *)
    echo "❌ Unknown command: $ACTION"
    show_help
    exit 1
    ;;
esac
