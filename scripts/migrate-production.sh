#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-common.sh
source "$SCRIPT_DIRECTORY/production-common.sh"
RELEASE_DIRECTORY="$(release_directory)"
load_production_environment
load_release_sha "$RELEASE_DIRECTORY"

mkdir -p "$SYNCASH_ROOT/shared/locks"
exec 9>"$SYNCASH_ROOT/shared/locks/migrate.lock"
flock -n 9 || { printf 'A SynCash migration is already running.\n' >&2; exit 1; }

compose "$RELEASE_DIRECTORY" --profile tools run --rm migrate
printf 'SynCash migrations completed for release %s.\n' "$RELEASE_SHA"
