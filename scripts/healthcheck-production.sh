#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-common.sh
source "$SCRIPT_DIRECTORY/production-common.sh"
RELEASE_DIRECTORY="$(release_directory)"
load_production_environment
load_release_sha "$RELEASE_DIRECTORY"

services=(postgres redis minio api frontend)
if [[ "$EMAIL_DELIVERY_ENABLED" == "true" ]]; then services+=(worker); fi
for service in "${services[@]}"; do
  wait_for_service_health "$RELEASE_DIRECTORY" "$service" 30
done

curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3181/api/health >/dev/null
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3180/healthz >/dev/null

disk_usage="$(df --output=pcent "$SYNCASH_ROOT" | tail -1 | tr -dc '0-9')"
if [[ -z "$disk_usage" || "$disk_usage" -ge 85 ]]; then
  printf 'SynCash disk usage is at or above 85%%.\n' >&2
  exit 1
fi

if [[ -f /etc/letsencrypt/live/app.syncash.co.il/fullchain.pem ]] && \
   ! openssl x509 -checkend 604800 -noout -in /etc/letsencrypt/live/app.syncash.co.il/fullchain.pem >/dev/null; then
  printf 'The SynCash TLS certificate expires within seven days.\n' >&2
  exit 1
fi

for service in postgres redis minio; do
  if [[ -n "$(compose "$RELEASE_DIRECTORY" port "$service" 5432 2>/dev/null || true)" || \
        -n "$(compose "$RELEASE_DIRECTORY" port "$service" 6379 2>/dev/null || true)" || \
        -n "$(compose "$RELEASE_DIRECTORY" port "$service" 9000 2>/dev/null || true)" ]]; then
    printf 'Private service %s unexpectedly exposes a host port.\n' "$service" >&2
    exit 1
  fi
done

if compose "$RELEASE_DIRECTORY" exec -T frontend sh -c "grep -R -E 'localhost|127\\.0\\.0\\.1|:9099|SMTP_PASSWORD|DATABASE_URL|FIELD_ENCRYPTION_KEY|PRIVATE_KEY|S3_SECRET' /usr/share/nginx/html" >/dev/null 2>&1; then
  printf 'A prohibited development URL or private secret name exists in the frontend bundle.\n' >&2
  exit 1
fi

printf 'All SynCash production services are healthy.\n'
