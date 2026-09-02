#!/bin/bash
# ==============================================================================
# SPOT — PostgreSQL Daily Automated Snapshot & Backup Script
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# Source environment variables
if [ -f .env.production ]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(POSTGRES_USER|POSTGRES_DB|DISCORD_WEBHOOK_URL)=' .env.production | sed 's/"//g')
elif [ -f .env ]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(POSTGRES_USER|POSTGRES_DB|DISCORD_WEBHOOK_URL)=' .env | sed 's/"//g')
fi

POSTGRES_USER="${POSTGRES_USER:-spot_user}"
POSTGRES_DB="${POSTGRES_DB:-spot_db}"
CONTAINER_NAME="spot-postgres"
BACKUP_DIR="${BACKUP_DIR:-/home/fazley/backups/spot}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/spot_db_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Ensure backup destination exists
mkdir -p "$BACKUP_DIR"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

send_discord_alert() {
  local title="$1"
  local desc="$2"
  local color="$3"

  if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
    local payload
    payload=$(cat <<EOF
{
  "embeds": [{
    "title": "${title}",
    "description": "${desc}",
    "color": ${color},
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "footer": { "text": "SPOT Homelab Automated Backup" }
  }]
}
EOF
)
    curl -s -H "Content-Type: application/json" -X POST -d "$payload" "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1 || true
  fi
}

log "========================================================"
log "🚀 Starting SPOT PostgreSQL daily snapshot..."

# 1. Verify container is healthy and running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "❌ Error: Container '${CONTAINER_NAME}' is not running!"
  send_discord_alert "❌ SPOT Backup Failed" "Database container \`${CONTAINER_NAME}\` is offline or not running." 15158332
  exit 1
fi

# 2. Execute pg_dump and stream directly into gzip
START_TIME="$(date +%s)"
if docker exec "$CONTAINER_NAME" pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges | gzip -9 > "$BACKUP_FILE"; then

  END_TIME="$(date +%s)"
  DURATION=$((END_TIME - START_TIME))

  # 3. Verify backup archive integrity
  if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log "❌ Error: Backup file verification failed (corrupted gzip archive)."
    send_discord_alert "❌ SPOT Backup Failed" "Backup file \`${BACKUP_FILE}\` failed gzip integrity verification." 15158332
    exit 1
  fi

  FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"

  # 4. Gather live stats for audit logging
  STATS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "
    SELECT 
      (SELECT count(*) FROM spots WHERE owner_id IS NOT NULL) || '|' ||
      (SELECT count(*) FROM citizens) || '|' ||
      (SELECT count(*) FROM citizen_passkeys) || '|' ||
      (SELECT count(*) FROM spot_comments);
  " 2>/dev/null || echo "0|0|0|0")

  IFS='|' read -r CLAIMED_SPOTS CITIZENS PASSKEYS COMMENTS <<< "$STATS"

  log "✅ Snapshot completed successfully in ${DURATION}s."
  log "📁 File: ${BACKUP_FILE} (${FILE_SIZE})"
  log "📊 Data snapshot: ${CLAIMED_SPOTS} claimed spots, ${CITIZENS} citizens, ${PASSKEYS} passkeys, ${COMMENTS} comments."

  # 5. Retention policy: Prune snapshots older than RETENTION_DAYS
  DELETED_COUNT=0
  while IFS= read -r old_file; do
    if [ -n "$old_file" ]; then
      rm -f "$old_file"
      log "🗑️ Pruned old snapshot: $(basename "$old_file")"
      DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
  done < <(find "$BACKUP_DIR" -name "spot_db_*.sql.gz" -mtime "+${RETENTION_DAYS}" 2>/dev/null || true)

  TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "spot_db_*.sql.gz" | wc -l | tr -d ' ')
  log "📦 Total retained snapshots: ${TOTAL_BACKUPS} (retention window: ${RETENTION_DAYS} days)"

  DISCORD_MSG="**File:** \`$(basename "$BACKUP_FILE")\` (${FILE_SIZE})
**Duration:** ${DURATION}s
**Claimed Spots:** ${CLAIMED_SPOTS}
**Citizens:** ${CITIZENS}
**Passkeys:** ${PASSKEYS}
**Retained Snapshots:** ${TOTAL_BACKUPS}"

  send_discord_alert "💾 SPOT Daily DB Snapshot Completed" "$DISCORD_MSG" 3066993

  log "========================================================"
  exit 0
else
  log "❌ Error: pg_dump execution failed!"
  send_discord_alert "❌ SPOT Backup Failed" "pg_dump command execution failed for database \`${POSTGRES_DB}\`." 15158332
  exit 1
fi
