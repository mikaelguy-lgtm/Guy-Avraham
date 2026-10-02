#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-common.sh
source "$SCRIPT_DIRECTORY/production-common.sh"
RELEASE_DIRECTORY="$(release_directory)"
load_production_environment
load_release_sha "$RELEASE_DIRECTORY"
require_environment_names BACKUP_ENCRYPTION_PASSPHRASE POSTGRES_DB POSTGRES_USER S3_ACCESS_KEY_ID S3_SECRET_KEY S3_BUCKET MINIO_BACKUP_IMAGE

BACKUP_KIND="${1:---daily}"
case "$BACKUP_KIND" in
  --daily) destination="$SYNCASH_ROOT/backups/daily" ;;
  --weekly) destination="$SYNCASH_ROOT/backups/weekly" ;;
  --pre-deploy) destination="$SYNCASH_ROOT/backups/pre-deploy" ;;
  *) printf 'Usage: %s [--daily|--weekly|--pre-deploy]\n' "$0" >&2; exit 2 ;;
esac

mkdir -p "$SYNCASH_ROOT/shared/locks" "$destination" "$SYNCASH_ROOT/shared/logs"
exec 9>"$SYNCASH_ROOT/shared/locks/backup.lock"
flock -n 9 || { printf 'A SynCash backup is already running.\n' >&2; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
staging="$(mktemp -d "$SYNCASH_ROOT/backups/.staging-$timestamp-XXXXXX")"
archive="$destination/syncash-$timestamp-$RELEASE_SHA.tar.gz"
encrypted="$archive.gpg"
cleanup() {
  sudo rm -rf -- "$staging"
  rm -f -- "$archive"
}
trap cleanup EXIT

mkdir -p "$staging/metadata" "$staging/config" "$staging/minio"
printf '%s\n' "$RELEASE_SHA" > "$staging/metadata/release-sha.txt"
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' > "$staging/metadata/containers.txt"
docker network ls --format '{{.Name}}|{{.Driver}}|{{.Scope}}' > "$staging/metadata/networks.txt"
docker volume ls --format '{{.Name}}|{{.Driver}}' > "$staging/metadata/volumes.txt"
ss -lntup > "$staging/metadata/listening-ports.txt"
sudo nginx -T 2>&1 | cat > "$staging/metadata/nginx.txt" || true
install -m 600 "$SYNCASH_ENV_FILE" "$staging/config/env.production"
if [[ -f /etc/nginx/sites-available/app.syncash.co.il.conf ]]; then
  install -m 600 /etc/nginx/sites-available/app.syncash.co.il.conf "$staging/config/nginx-app.conf"
fi

postgres_id="$(compose "$RELEASE_DIRECTORY" ps -q postgres 2>/dev/null || true)"
if [[ -n "$postgres_id" && "$(docker inspect --format '{{.State.Running}}' "$postgres_id")" == "true" ]]; then
  compose "$RELEASE_DIRECTORY" exec -T postgres sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_dump --format=custom --no-owner --no-acl --username=\"\$POSTGRES_USER\" \"\$POSTGRES_DB\"" > "$staging/postgres.dump"
fi

minio_id="$(compose "$RELEASE_DIRECTORY" ps -q minio 2>/dev/null || true)"
if [[ -n "$minio_id" && "$(docker inspect --format '{{.State.Running}}' "$minio_id")" == "true" ]]; then
  if docker run --rm --network syncash-prod-internal \
    -e "MC_HOST_syncash=http://$S3_ACCESS_KEY_ID:$S3_SECRET_KEY@minio:9000" \
    "$MINIO_BACKUP_IMAGE" stat "syncash/$S3_BUCKET" >/dev/null 2>&1; then
    docker run --rm --network syncash-prod-internal \
      -e "MC_HOST_syncash=http://$S3_ACCESS_KEY_ID:$S3_SECRET_KEY@minio:9000" \
      -v "$staging/minio:/backup" \
      "$MINIO_BACKUP_IMAGE" mirror --overwrite "syncash/$S3_BUCKET" /backup >/dev/null
  fi
fi

tar -C "$staging" -czf "$archive" .
printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --symmetric --cipher-algo AES256 --output "$encrypted" "$archive"
(cd "$(dirname "$encrypted")" && sha256sum "$(basename "$encrypted")" > "$(basename "$encrypted").sha256")
chmod 600 "$encrypted" "$encrypted.sha256"

if [[ "$BACKUP_KIND" == "--daily" && "$(date -u +%u)" == "7" ]]; then
  install -m 600 "$encrypted" "$SYNCASH_ROOT/backups/weekly/$(basename "$encrypted")"
  install -m 600 "$encrypted.sha256" "$SYNCASH_ROOT/backups/weekly/$(basename "$encrypted.sha256")"
fi

find "$SYNCASH_ROOT/backups/daily" -maxdepth 1 -type f -mtime +14 -delete 2>/dev/null || true
find "$SYNCASH_ROOT/backups/weekly" -maxdepth 1 -type f -mtime +28 -delete 2>/dev/null || true
printf '%s backup completed: %s\n' "$BACKUP_KIND" "$(basename "$encrypted")" | tee -a "$SYNCASH_ROOT/shared/logs/backup.log"
