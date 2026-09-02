#!/bin/bash
# ==============================================================================
# SPOT — Supabase to Homelab Database Migration Script
# ==============================================================================

set -e

echo "========================================================"
echo " SPOT: Supabase -> Homelab PostgreSQL Data Migration"
echo "========================================================"

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo "Usage: SUPABASE_DB_URL='postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres' ./scripts/migrate-supabase-to-homelab.sh"
  exit 1
fi

BACKUP_FILE="spot_supabase_export_$(date +%Y%m%d_%H%M%S).sql"

echo "📦 1. Ensuring spot-postgres container is running..."
if ! docker ps --format '{{.Names}}' | grep -q "^spot-postgres$"; then
  echo "Starting spot-postgres container..."
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d spot-postgres
  sleep 5
fi

echo "📥 2. Exporting data from Supabase..."
cat << 'HEADER' > "$BACKUP_FILE"
SET session_replication_role = 'replica';
TRUNCATE TABLE spot_comments, referrals, citizen_passkeys, citizen_sessions, moderation_flags, spots, citizens CASCADE;
HEADER

docker exec -i spot-postgres pg_dump \
  --data-only \
  --column-inserts \
  -t citizens -t spots -t citizen_passkeys -t citizen_sessions -t spot_comments -t site_stats -t moderation_flags -t referrals \
  "$SUPABASE_DB_URL" >> "$BACKUP_FILE"

cat << 'FOOTER' >> "$BACKUP_FILE"
SET session_replication_role = 'origin';
FOOTER

echo "✓ Export completed: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "🚀 3. Restoring data into local spot-postgres container..."
docker exec -i spot-postgres psql -U spot_user -d spot_db < "$BACKUP_FILE"

echo "🔍 4. Verifying imported data counts:"
docker exec -i spot-postgres psql -U spot_user -d spot_db -c "
  SELECT 
    (SELECT count(*) FROM spots WHERE owner_id IS NOT NULL) as claimed_spots,
    (SELECT count(*) FROM citizens) as citizens,
    (SELECT count(*) FROM citizen_passkeys) as passkeys,
    (SELECT value FROM site_stats WHERE key = 'total_visitors') as total_visitors;
"

echo "========================================================"
echo "✅ Supabase migration to local PostgreSQL successful!"
echo "========================================================"
