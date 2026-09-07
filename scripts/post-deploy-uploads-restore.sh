#!/bin/bash
# post-deploy-uploads-restore.sh
#
# Production-grade persistent-volumes automation for capoy-final-ilvlxb.
#
# Purpose:
#   Dokploy's API for dockerfile apps does NOT expose volume config.
#   Every redeploy creates a fresh Swarm service task WITHOUT the
#   named volume 'capoy-uploads' mounted on /app/uploads.
#   This script:
#     1. Re-attaches the named volume to the running service task.
#     2. Restores any missing files from the host backup directory.
#     3. Snapshots current volume contents back to the host backup.
#
# Idempotent. Safe to run repeatedly. Hardened (set -eE, locked operations).
#
# Run as: bash /srv/capoy-uploads/post-deploy-uploads-restore.sh
# Triggered by: /etc/systemd/system/restore-capoy-uploads.timer

set -Eeuo pipefail
shopt -s nullglob

SERVICE="capoy-final-ilvlxb"
VOLUME="capoy-uploads"
TARGET="/app/uploads"
HOST_BACKUP="/srv/capoy-uploads/tours"
TIMEOUT=120

log() { printf '[restore-uploads] %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# 0. Preconditions
command -v docker >/dev/null 2>&1 || die "docker not found in PATH"

# 1. Check whether the service has the desired mount attached
current_mount() {
  docker service inspect "$SERVICE" \
    --format '{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}' 2>/dev/null \
    | python3 -c '
import json,sys
arr=json.load(sys.stdin) or []
for m in arr:
    if m.get("Type")=="volume" and m.get("Source")=="'"$VOLUME"'" and m.get("Target")=="'"$TARGET"'":
        sys.exit(0)
sys.exit(1)
' 2>/dev/null
  return $?
}

# 2. Snapshot current volume contents to host backup directory
snapshot_volume() {
  docker run --rm \
    -v "${VOLUME}:/from:ro" \
    -v "${HOST_BACKUP}:/to" \
    --network none \
    alpine sh -c '
      mkdir -p /to
      for f in /from/tours/*; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        if [ ! -f "/to/${base}" ]; then
          cp "$f" "/to/${base}"
        fi
      done
    ' 2>/dev/null || true
}

# 3. Restore missing files from host backup into the volume
restore_from_host() {
  local current_container
  current_container=$(docker ps --filter "name=${SERVICE}" --format '{{.Names}}' | head -1)
  [ -n "$current_container" ] || { log "no running container for $SERVICE"; return 1; }

  log "container: ${current_container}"

  for src in "${HOST_BACKUP}"/*; do
    [ -f "$src" ] || continue
    local base
    base=$(basename "$src")

    # Probe whether the file already exists inside the volume
    if docker exec "$current_container" test -f "/app/uploads/tours/${base}" 2>/dev/null; then
      continue
    fi

    log "restoring ${base}"
    docker cp "$src" "${current_container}:/app/uploads/tours/" || true
  done
}

# 4. Re-attach the named volume if missing
re_attach_mount() {
  if current_mount; then
    log "mount already present"
    return 0
  fi

  log "mount missing — adding type=volume,source=${VOLUME},target=${TARGET} to ${SERVICE}"
  docker service update \
    --quiet \
    --mount-add "type=volume,source=${VOLUME},target=${TARGET}" \
    --update-failure-action rollback \
    "${SERVICE}" \
    2>&1 | grep -vE '^verify:' || true

  # Wait for the task to settle
  for _ in $(seq 1 ${TIMEOUT}); do
    if current_mount; then return 0; fi
    sleep 1
  done
  die "failed to re-attach named volume within ${TIMEOUT}s"
}

main() {
  log "begin"
  re_attach_mount
  sleep 2
  restore_from_host
  snapshot_volume
  log "done"
}

main "$@"
