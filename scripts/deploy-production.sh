#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-common.sh
source "$SCRIPT_DIRECTORY/production-common.sh"
RELEASE_DIRECTORY="$(release_directory)"
load_production_environment

RELEASE_SHA="${1:-${RELEASE_SHA:-}}"
if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  printf 'A valid Git release SHA is required.\n' >&2
  exit 2
fi
printf 'RELEASE_SHA=%s\n' "$RELEASE_SHA" > "$RELEASE_DIRECTORY/.release.env"
chmod 600 "$RELEASE_DIRECTORY/.release.env"
export RELEASE_SHA

require_environment_names \
  APP_URL PUBLIC_APP_URL API_BASE_URL EXTERNAL_REVIEW_BASE_URL EXTERNAL_ACCESS_BASE_URL ALLOWED_ORIGINS SYNCASH_RUNTIME_UID SYNCASH_RUNTIME_GID \
  POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL REDIS_PASSWORD REDIS_URL \
  S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_KEY \
  SECRET_PROVIDER GOOGLE_CLOUD_PROJECT GOOGLE_APPLICATION_CREDENTIALS FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL \
  SMTP_HOST SMTP_PORT SMTP_USER EMAIL_FROM EMAIL_REPLY_TO \
  VITE_API_BASE_URL VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID \
  VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID BACKUP_ENCRYPTION_PASSPHRASE

if [[ "$SECRET_PROVIDER" != "google" ]]; then
  printf 'Production requires the Google Secret Manager provider.\n' >&2
  exit 1
fi
if [[ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" || "$(stat -c '%a' "$GOOGLE_APPLICATION_CREDENTIALS")" != "600" ]]; then
  printf 'Google application credentials must exist with mode 600.\n' >&2
  exit 1
fi
if [[ "$VITE_USE_FIREBASE_EMULATOR" != "false" || -n "${FIREBASE_AUTH_EMULATOR_HOST:-}" ]]; then
  printf 'Firebase Emulator is forbidden in production.\n' >&2
  exit 1
fi
if grep -Eq 'localhost|127\.0\.0\.1|mailpit|firebase-auth' "$SYNCASH_ENV_FILE"; then
  printf 'Development endpoints are forbidden in the production environment file.\n' >&2
  exit 1
fi

mkdir -p "$SYNCASH_ROOT/shared/locks" "$SYNCASH_ROOT/shared/logs"
exec 9>"$SYNCASH_ROOT/shared/locks/deploy.lock"
flock -n 9 || { printf 'A SynCash deployment is already running.\n' >&2; exit 1; }

compose "$RELEASE_DIRECTORY" config --quiet
"$SCRIPT_DIRECTORY/backup-production.sh" --pre-deploy
compose "$RELEASE_DIRECTORY" build --pull api frontend
compose "$RELEASE_DIRECTORY" up -d postgres redis minio
for service in postgres redis minio; do wait_for_service_health "$RELEASE_DIRECTORY" "$service" 180; done
compose "$RELEASE_DIRECTORY" run --rm --no-deps api node dist-server/src/server/productionSecrets.js
"$SCRIPT_DIRECTORY/migrate-production.sh"
compose "$RELEASE_DIRECTORY" up -d api worker frontend
"$SCRIPT_DIRECTORY/healthcheck-production.sh"

if [[ -L "$SYNCASH_ROOT/current" ]]; then
  readlink -f "$SYNCASH_ROOT/current" > "$SYNCASH_ROOT/shared/previous-release"
fi
ln -sfn "$RELEASE_DIRECTORY" "$SYNCASH_ROOT/current.next"
mv -Tf "$SYNCASH_ROOT/current.next" "$SYNCASH_ROOT/current"
"$SCRIPT_DIRECTORY/install-production-timers.sh"
printf '%s|%s|success\n' "$(date -u --iso-8601=seconds)" "$RELEASE_SHA" >> "$SYNCASH_ROOT/shared/logs/deployments.log"
printf 'SynCash release %s deployed successfully.\n' "$RELEASE_SHA"
