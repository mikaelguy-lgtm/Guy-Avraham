#!/usr/bin/env bash
set -euo pipefail

SYNCASH_ROOT="${SYNCASH_ROOT:-/opt/syncash}"
SYNCASH_ENV_FILE="${SYNCASH_ENV_FILE:-$SYNCASH_ROOT/shared/env/.env.production}"
SYNCASH_PROJECT="syncash-prod"

release_directory() {
  cd "$(dirname "${BASH_SOURCE[1]}")/.." && pwd
}

load_production_environment() {
  if [[ ! -f "$SYNCASH_ENV_FILE" ]]; then
    printf 'Missing production environment file: %s\n' "$SYNCASH_ENV_FILE" >&2
    return 1
  fi
  if [[ "$(stat -c '%a' "$SYNCASH_ENV_FILE")" != "600" ]]; then
    printf 'Production environment file must have mode 600.\n' >&2
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$SYNCASH_ENV_FILE"
  set +a
  export SYNCASH_ENV_FILE
}

require_environment_names() {
  local missing=()
  local name
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then missing+=("$name"); fi
  done
  if (( ${#missing[@]} > 0 )); then
    printf 'Missing required production variables: %s\n' "${missing[*]}" >&2
    return 1
  fi
}

load_release_sha() {
  local directory="$1"
  if [[ -f "$directory/.release.env" ]]; then
    # shellcheck disable=SC1091
    source "$directory/.release.env"
  fi
  require_environment_names RELEASE_SHA
  export RELEASE_SHA
}

compose() {
  local directory="$1"
  shift
  docker compose \
    --project-name "$SYNCASH_PROJECT" \
    --env-file "$SYNCASH_ENV_FILE" \
    --env-file "$directory/.release.env" \
    --file "$directory/compose.production.yml" \
    "$@"
}

wait_for_service_health() {
  local directory="$1"
  local service="$2"
  local timeout_seconds="${3:-180}"
  local deadline=$((SECONDS + timeout_seconds))
  while (( SECONDS < deadline )); do
    local container_id
    container_id="$(compose "$directory" ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      local state health
      state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
      if [[ "$state" == "running" && ( "$health" == "healthy" || "$health" == "none" ) ]]; then return 0; fi
      if [[ "$state" == "exited" || "$state" == "dead" ]]; then
        printf 'Service %s stopped before becoming healthy.\n' "$service" >&2
        return 1
      fi
    fi
    sleep 3
  done
  printf 'Timed out waiting for service %s.\n' "$service" >&2
  return 1
}
