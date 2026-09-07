#!/bin/bash
# capoy-daily-backup.sh
# Consolitaded daily backup of:
#  - MySQL capoy_final schema + data
#  - /etc/dokploy/applications/capoy-final-ilvlxb (Dokploy app metadata)
#  - /srv/capoy-uploads (uploads host backup)
#  - /var/lib/docker/volumes/capoy-uploads (Docker named volume raw data)
# Rotation: keep 7 daily, 4 weekly, 3 monthly. Delete the rest.
# Runs as: /etc/cron.daily/capoy-daily-backup (or systemd timer daily)

set -Eeuo pipefail
shopt -s nullglob

BACKUP_ROOT="/srv/capoy-backups"
DAILY="${BACKUP_ROOT}/daily"
WEEKLY="${BACKUP_ROOT}/weekly"
MONTHLY="${BACKUP_ROOT}/monthly"
MYSQL_CONT_LABEL="capoy-final-6wsges.1"

DAY_OF_WEEK=$(date +%u)   # 1..7
DAY_OF_MONTH=$(date +%d)  # 01..31

SNAP="${DAILY}/$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$SNAP"

log() { printf '[capoy-backup] %s\n' "$*"; }

# 1. MySQL dump
log "dumping mysql into ${SNAP}/mysql"
MYSQL_CONT=$(docker ps --filter "name=${MYSQL_CONT_LABEL}" -q | head -1)
[ -n "$MYSQL_CONT" ] || { log "ERROR: mysql container not found"; exit 1; }
docker exec -i "$MYSQL_CONT" sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final' \
  > "${SNAP}/mysql-capoy_final.sql" 2>/dev/null
test -s "${SNAP}/mysql-capoy_final.sql" || { log "ERROR: mysql dump empty"; exit 1; }

# 2. App metadata (Dokploy code + env)
log "copying app metadata into ${SNAP}/app-metadata"
mkdir -p "${SNAP}/app-metadata"
[ -d /etc/dokploy/applications/capoy-final-ilvlxb ] && \
  cp -a /etc/dokploy/applications/capoy-final-ilvlxb "${SNAP}/app-metadata/"

# 3. Uploads host backup
log "syncing uploads host backup into ${SNAP}/uploads-host"
mkdir -p "${SNAP}/uploads-host"
[ -d /srv/capoy-uploads/tours ] && \
  rsync -a --delete /srv/capoy-uploads/tours/ "${SNAP}/uploads-host/tours/" 2>/dev/null || \
  cp -a /srv/capoy-uploads/tours/. "${SNAP}/uploads-host/tours/" 2>/dev/null || true

# 4. Raw Docker named volume data (belt and suspenders)
log "copying raw docker volume data into ${SNAP}/docker-volume"
mkdir -p "${SNAP}/docker-volume"
if [ -d /var/lib/docker/volumes/capoy-uploads ]; then
  cp -a /var/lib/docker/volumes/capoy-uploads/. "${SNAP}/docker-volume/" 2>/dev/null || true
fi

# 5. Manifest
cat > "${SNAP}/manifest.txt" <<EOF
capoy-daily-backup
created: $(date -Iseconds)
host: $(hostname)
git HEAD: $(cd /etc/dokploy/applications/capoy-final-ilvlxb/code && git rev-parse HEAD 2>/dev/null || echo unknown)
endpoints health: $(curl -sS -m 5 -o /dev/null -w '%{http_code}' https://capoycostarica.com/api/health 2>/dev/null || echo unreachable)
EOF

# 6. Compress
log "compressing snapshot"
tar -czf "${SNAP}.tar.gz" -C "$(dirname "$SNAP")" "$(basename "$SNAP")"
rm -rf "$SNAP"

# 7. Promote weekly / monthly
SNAP_GZ="${SNAP}.tar.gz"
[ -f "$SNAP_GZ" ] || { log "ERROR: snapshot not found"; exit 1; }

if [ "$DAY_OF_WEEK" = "7" ]; then
  cp -p "$SNAP_GZ" "${WEEKLY}/$(basename "$SNAP_GZ")"
  log "promoted to weekly"
fi
if [ "$DAY_OF_MONTH" = "01" ]; then
  cp -p "$SNAP_GZ" "${MONTHLY}/$(basename "$SNAP_GZ")"
  log "promoted to monthly"
fi

# 8. Rotation (delete oldest beyond count)
prune() {
  local dir="$1" keep="$2"
  local count
  count=$(ls -1 "$dir" 2>/dev/null | wc -l)
  if [ "$count" -gt "$keep" ]; then
    ls -1tr "$dir" | head -n "$((count - keep))" | while read -r f; do
      rm -f "$dir/$f"
    done
    log "pruned $((count - keep)) from $(basename "$dir") (keep=$keep)"
  fi
}
mkdir -p "$DAILY" "$WEEKLY" "$MONTHLY"
prune "$DAILY" 7
prune "$WEEKLY" 4
prune "$MONTHLY" 3

log "done. snapshot: ${SNAP_GZ}"
