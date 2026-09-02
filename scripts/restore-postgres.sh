#!/bin/bash
# ==============================================================================
# SPOT — PostgreSQL Database Snapshot Restore Tool
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env.production ]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env.production | sed 's/"//g')
elif [ -f .env ]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env | sed 's/"//g')
fi

POSTGRES_USER="${POSTGRES_USER:-spot_user}"
POSTGRES_DB="${POSTGRES_DB:-spot_db}"
CONTAINER_NAME="spot-postgres"
BACKUP_DIR="${BACKUP_DIR:-/home/fazley/backups/spot}"

# Target backup file from argument, or pick latest
if [ $# -ge 1 ] && [ -n "$1" ] && [ "$1" != "--yes" ]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE=$(find "$BACKUP_DIR" -name "spot_db_*.sql.gz" 2>/dev/null | sort -r | head -n 1 || true)
fi

AUTO_CONFIRM=false
for arg in "$@"; do
  if [ "$arg" == "--yes" ] || [ "$arg" == "-y" ]; then
    AUTO_CONFIRM=true
  fi
done

if [ -z "${BACKUP_FILE:-}" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: No backup file found to restore."
  echo "Usage: ./scripts/restore-postgres.sh [/path/to/spot_db_YYYYMMDD_HHMMSS.sql.gz] [--yes]"
  exit 1
fi

echo "========================================================"
echo "⚠️  SPOT: PostgreSQL Snapshot Restore"
echo "========================================================"
echo "📁 Target Backup: $BACKUP_FILE"
echo "🗄️ Target Database: $POSTGRES_DB on $CONTAINER_NAME"
echo "📏 Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "--------------------------------------------------------"

if [ "$AUTO_CONFIRM" = false ]; then
  read -r -p "🚨 WARNING: This will overwrite existing database data. Proceed? (y/N): " response
  if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Aborted by user."
    exit 0
  fi
fi

# 1. Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "❌ Error: Database container '${CONTAINER_NAME}' is not running."
  exit 1
fi

# 2. Decompress and restore stream
echo "🔄 Restoring snapshot into database..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

echo "🔍 Verifying restored database counts:"
docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT 
    (SELECT count(*) FROM spots) as total_spots,
    (SELECT count(*) FROM spots WHERE owner_id IS NOT NULL) as claimed_spots,
    (SELECT count(*) FROM citizens) as citizens,
    (SELECT count(*) FROM citizen_passkeys) as passkeys,
    (SELECT count(*) FROM spot_comments) as comments;
"

echo "========================================================"
echo "✅ Snapshot restoration completed successfully!"
echo "========================================================"
