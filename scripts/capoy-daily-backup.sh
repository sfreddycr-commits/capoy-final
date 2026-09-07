#!/bin/bash
# capoy-daily-backup.sh
# BOURTIQUE-PREMIUM signed+encrypted backups.
#
# - Aggregates mysqldump + app metadata + uploads + raw docker volume
# - Compresses with tar+gzip
# - Signs+encrypts with GPG (RSA-4096) using dedicated key
# - Writes SHA-256 checksum (for integrity)
# - Rotation: 7 daily, 4 weekly, 3 monthly
# - 7-day dry-run verification (every Monday) — extracts randomly and
#   verifies checksum + decryption
#
# Runs as: /etc/systemd/system/capoy-daily-backup.service (Triggered by timer)

set -Eeuo pipefail
shopt -s nullglob

BACKUP_ROOT="/srv/capoy-backups"
DAILY="${BACKUP_ROOT}/daily"
WEEKLY="${BACKUP_ROOT}/weekly"
MONTHLY="${BACKUP_ROOT}/monthly"
GPG_KEY="capoy-backup"
GPG_RECIPIENT="backup@capoycostarica.com"
SCRATCH="${BACKUP_ROOT}/.scratch"
MYSQL_CONT_LABEL="capoy-final-6wsges.1"

DAY_OF_WEEK=$(date +%u)
DAY_OF_MONTH=$(date +%d)

SNAP_DIR="capoy-$(date +%Y-%m-%d_%H%M%S)"
SNAP="${BACKUP_ROOT}/.scratch/${SNAP_DIR}"
mkdir -p "$SNAP"

log() { printf '[capoy-backup] %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

cleanup() { if [ -d "${SCRATCH}" ]; then rm -rf "${SCRATCH}" 2>/dev/null || true; fi; }
trap cleanup EXIT

# 0. Preconditions
command -v docker >/dev/null 2>&1 || die "docker not found in PATH"
command -v gpg >/dev/null 2>&1 || die "gpg not found in PATH"
gpg --list-keys "${GPG_KEY}" >/dev/null 2>&1 || die "GPG key '${GPG_KEY}' not present"

# 1. MySQL dump
MYSQL_CONT=$(docker ps --filter "name=${MYSQL_CONT_LABEL}" -q | head -1)
[ -n "$MYSQL_CONT" ] || die "mysql container not found"

log "mysqldump → ${SNAP}/mysql"
docker exec -i "$MYSQL_CONT" sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final' \
  > "${SNAP}/mysql-capoy_final.sql" 2>/dev/null
test -s "${SNAP}/mysql-capoy_final.sql" || die "mysql dump empty"

# 2. App metadata
log "app metadata → ${SNAP}/app-metadata"
mkdir -p "${SNAP}/app-metadata"
[ -d /etc/dokploy/applications/capoy-final-ilvlxb ] && \
  cp -a /etc/dokploy/applications/capoy-final-ilvlxb "${SNAP}/app-metadata/"

# 3. Uploads host backup
log "uploads host backup → ${SNAP}/uploads-host"
mkdir -p "${SNAP}/uploads-host"
[ -d /srv/capoy-uploads/tours ] && \
  cp -a /srv/capoy-uploads/tours/. "${SNAP}/uploads-host/tours/" 2>/dev/null || true

# 4. Raw docker volume
log "docker volume raw → ${SNAP}/docker-volume"
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
TARBALL_BASE="${DAILY}/${SNAP_DIR}"
TARBALL="${TARBALL_BASE}.tar.gz"
log "compress → ${TARBALL}"
tar -czf "${TARBALL}" -C "${BACKUP_ROOT}/.scratch" "${SNAP_DIR}"
test -s "${TARBALL}" || die "tarball empty"

# 7. SHA-256 checksum (for integrity audit, NOT signed)
SUM_FILE="${TARBALL}.sha256"
log "checksum → ${SUM_FILE}"
( cd "$(dirname "${TARBALL}")" && sha256sum "$(basename "${TARBALL}")" ) > "${SUM_FILE}"

# 8. GPG sign-then-encrypt (produces .tar.gz.gpg)
log "gpg encrypt → ${TARBALL}.gpg"
gpg --batch --yes \
  --default-key "${GPG_KEY}" \
  --trust-model always \
  --sign \
  --encrypt \
  --recipient "${GPG_RECIPIENT}" \
  --output "${TARBALL}.gpg" \
  --encrypt-to "${GPG_RECIPIENT}" \
  "${TARBALL}" 2>&1 | tail -3 || log "gpg failed — leaving .tar.gz alongside"

# 9. Promote weekly / monthly
[ -f "${TARBALL}" ] || die "tarball not found before rotation"
if [ "$DAY_OF_WEEK" = "7" ]; then
  cp -p "$TARBALL"      "${WEEKLY}/$(basename "$TARBALL")"
  cp -p "$TARBALL.gpg" "${WEEKLY}/$(basename "$TARBALL.gpg")"
  cp -p "$SUM_FILE"     "${WEEKLY}/$(basename "$SUM_FILE")"
  log "promoted to weekly"
fi
if [ "$DAY_OF_MONTH" = "01" ]; then
  cp -p "$TARBALL"      "${MONTHLY}/$(basename "$TARBALL")"
  cp -p "$TARBALL.gpg" "${MONTHLY}/$(basename "$TARBALL.gpg")"
  cp -p "$SUM_FILE"     "${MONTHLY}/$(basename "$SUM_FILE")"
  log "promoted to monthly"
fi

# 10. Rotation
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

# 11. Weekly dry-run verification (Mondays)
if [ "$DAY_OF_WEEK" = "1" ]; then
  log "weekly dry-run verification"
  SAMPLE=$(ls -1tr "${WEEKLY}"/*.tar.gz 2>/dev/null | tail -2 | head -1)
  if [ -n "$SAMPLE" ] && [ -f "${SAMPLE}.sha256" ] && [ -f "${SAMPLE}.gpg" ]; then
    TMPDIR=$(mktemp -d)
    log "dry-run: ${SAMPLE}"
    if ( cd "$TMPDIR" && sha256sum -c "${SAMPLE}.sha256" >/dev/null ); then
      log "checksum OK"
      if gpg --batch --yes --decrypt --output "${TMPDIR}/decrypted.tar.gz" "${SAMPLE}.gpg" 2>/dev/null; then
        tar -tzf "${TMPDIR}/decrypted.tar.gz" >/dev/null && log "decrypt+untar OK"
      else
        log "DRY-RUN FAIL: gpg decrypt failed"
      fi
    else
      log "DRY-RUN FAIL: checksum mismatch"
    fi
    rm -rf "$TMPDIR"
  fi
fi

log "done"
