#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-common.sh
source "$SCRIPT_DIRECTORY/production-common.sh"
load_production_environment

target="${1:-}"
if [[ -z "$target" && -f "$SYNCASH_ROOT/shared/previous-release" ]]; then target="$(cat "$SYNCASH_ROOT/shared/previous-release")"; fi
if [[ -z "$target" ]]; then printf 'No previous SynCash release is recorded.\n' >&2; exit 1; fi
target="$(readlink -f "$target")"
case "$target" in
  "$SYNCASH_ROOT"/releases/*) ;;
  *) printf 'Rollback target is outside the SynCash releases directory.\n' >&2; exit 1 ;;
esac
if [[ ! -f "$target/compose.production.yml" || ! -f "$target/.release.env" ]]; then
  printf 'Rollback target is incomplete.\n' >&2
  exit 1
fi

mkdir -p "$SYNCASH_ROOT/shared/locks" "$SYNCASH_ROOT/shared/logs"
exec 9>"$SYNCASH_ROOT/shared/locks/deploy.lock"
flock -n 9 || { printf 'A SynCash deployment or rollback is already running.\n' >&2; exit 1; }
load_release_sha "$target"
compose "$target" config --quiet
services=(postgres redis minio api frontend)
if [[ "$EMAIL_DELIVERY_ENABLED" == "true" ]]; then services+=(worker); fi
compose "$target" up -d --no-build "${services[@]}"
"$target/scripts/healthcheck-production.sh"
ln -sfn "$target" "$SYNCASH_ROOT/current.next"
mv -Tf "$SYNCASH_ROOT/current.next" "$SYNCASH_ROOT/current"
printf '%s|%s|rollback\n' "$(date -u --iso-8601=seconds)" "$RELEASE_SHA" >> "$SYNCASH_ROOT/shared/logs/deployments.log"
printf 'SynCash rollback completed to release %s. Database migrations were not reversed.\n' "$RELEASE_SHA"
