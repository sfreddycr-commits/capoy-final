#!/bin/bash
# capoy-watchdog.sh
# Verifies:
#   1. systemd timer is active and enabled
#   2. last service run succeeded
#   3. named volume is currently attached to service
#   4. /app/uploads/tours is reachable from running container
# Logs warnings to journal. Cron-friendly (exit non-zero on issues).

set -Eeuo pipefail

SERVICE="capoy-final-ilvlxb"
VOLUME="capoy-uploads"
TARGET="/app/uploads"

warn() { printf '[capoy-watchdog] WARNING: %s\n' "$*" >&2; }
info() { printf '[capoy-watchdog] %s\n' "$*"; }
fail=0

# 1. Timer active?
if ! systemctl is-active --quiet restore-capoy-uploads.timer; then
  warn "restore-capoy-uploads.timer is NOT active"
  fail=1
else
  info "timer is active"
fi

# 2. Timer enabled at boot?
if ! systemctl is-enabled --quiet restore-capoy-uploads.timer; then
  warn "restore-capoy-uploads.timer is NOT enabled at boot"
  fail=1
else
  info "timer is enabled"
fi

# 3. Last service run succeeded?
LAST_STATUS=$(systemctl show restore-capoy-uploads.service --property=ExecMainStatus --value 2>/dev/null || echo unknown)
if [ "$LAST_STATUS" != "0" ] && [ "$LAST_STATUS" != "unknown" ]; then
  warn "last restore-capoy-uploads.service run failed (ExecMainStatus=$LAST_STATUS)"
  fail=1
else
  info "last service run OK (ExecMainStatus=$LAST_STATUS)"
fi

# 4. Mount attached?
current_mount=$(docker service inspect "$SERVICE" \
  --format '{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}' 2>/dev/null)
if echo "$current_mount" | python3 -c '
import json,sys
arr=json.load(sys.stdin) or []
for m in arr:
    if m.get("Type")=="volume" and m.get("Source")=="'"$VOLUME"'" and m.get("Target")=="'"$TARGET"'":
        sys.exit(0)
sys.exit(1)
' 2>/dev/null; then
  info "named volume attached"
else
  warn "named volume NOT attached to $SERVICE — restoring now"
  bash /srv/capoy-uploads/post-deploy-uploads-restore.sh || fail=1
fi

# 5. Container reachable?
CONTAINER=$(docker ps --filter "name=${SERVICE}" --format '{{.Names}}' | head -1)
if [ -z "$CONTAINER" ]; then
  warn "no running container for $SERVICE"
  fail=1
else
  if docker exec "$CONTAINER" test -d /app/uploads/tours 2>/dev/null; then
    info "uploads directory reachable in container"
  else
    warn "uploads directory NOT reachable in container"
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

info "all checks passed"
exit 0
