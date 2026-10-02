#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-common.sh
source "$SCRIPT_DIRECTORY/production-common.sh"
RELEASE_DIRECTORY="$(release_directory)"
load_production_environment
load_release_sha "$RELEASE_DIRECTORY"
require_environment_names BACKUP_ENCRYPTION_PASSPHRASE MINIO_BACKUP_IMAGE

mode="${1:-}"
backup_file="${2:-}"
if [[ "$mode" != "--test" || -z "$backup_file" ]]; then
  printf 'Only isolated restore tests are automated. Usage: %s --test <backup.tar.gz.gpg>\n' "$0" >&2
  printf 'Production restore requires a reviewed, manual recovery plan and is intentionally not automatic.\n' >&2
  exit 2
fi
if [[ ! -f "$backup_file" || ! -f "$backup_file.sha256" ]]; then
  printf 'Backup or checksum file is missing.\n' >&2
  exit 1
fi
(cd "$(dirname "$backup_file")" && sha256sum --check "$(basename "$backup_file").sha256")

mkdir -p "$SYNCASH_ROOT/shared/locks"
exec 9>"$SYNCASH_ROOT/shared/locks/restore-test.lock"
flock -n 9 || { printf 'A SynCash restore test is already running.\n' >&2; exit 1; }

suffix="$(date -u +%Y%m%d%H%M%S)-$$"
prefix="syncash-restore-test-$suffix"
network="$prefix-network"
postgres_volume="$prefix-postgres"
minio_volume="$prefix-minio"
postgres_container="$prefix-postgres"
minio_container="$prefix-minio"
work="$(mktemp -d "$SYNCASH_ROOT/backups/.restore-test-$suffix-XXXXXX")"
test_password="$(openssl rand -hex 24)"
cleanup() {
  [[ "$prefix" == syncash-restore-test-* ]] || return 1
  docker rm -f "$postgres_container" "$minio_container" >/dev/null 2>&1 || true
  docker volume rm "$postgres_volume" "$minio_volume" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT

printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt --output "$work/backup.tar.gz" "$backup_file"
mkdir "$work/unpacked"
tar -C "$work/unpacked" -xzf "$work/backup.tar.gz"

docker network create "$network" >/dev/null
docker volume create "$postgres_volume" >/dev/null
docker volume create "$minio_volume" >/dev/null
docker run -d --name "$postgres_container" --network "$network" -e POSTGRES_DB=syncash_restore -e POSTGRES_USER=syncash_restore -e "POSTGRES_PASSWORD=$test_password" -v "$postgres_volume:/var/lib/postgresql/data" postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  if docker exec -e "PGPASSWORD=$test_password" "$postgres_container" pg_isready -U syncash_restore -d syncash_restore >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec -e "PGPASSWORD=$test_password" "$postgres_container" pg_isready -U syncash_restore -d syncash_restore >/dev/null
if [[ -f "$work/unpacked/postgres.dump" ]]; then
  docker exec -i -e "PGPASSWORD=$test_password" "$postgres_container" pg_restore --exit-on-error --no-owner --no-acl -U syncash_restore -d syncash_restore < "$work/unpacked/postgres.dump"
  docker exec -e "PGPASSWORD=$test_password" "$postgres_container" psql -U syncash_restore -d syncash_restore -Atqc 'select count(*) from drizzle.__drizzle_migrations' >/dev/null 2>&1 || \
    docker exec -e "PGPASSWORD=$test_password" "$postgres_container" psql -U syncash_restore -d syncash_restore -Atqc 'select 1' >/dev/null
fi

if [[ -d "$work/unpacked/minio" && -n "$(find "$work/unpacked/minio" -mindepth 1 -print -quit)" ]]; then
  docker run -d --name "$minio_container" --network "$network" -e "MINIO_ROOT_USER=restoretest" -e "MINIO_ROOT_PASSWORD=$test_password" -v "$minio_volume:/data" quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z server /data >/dev/null
  sleep 5
  docker run --rm --entrypoint /bin/sh --network "$network" -e "MC_HOST_restore=http://restoretest:$test_password@$minio_container:9000" -v "$work/unpacked/minio:/backup:ro" "$MINIO_BACKUP_IMAGE" -c 'mc mb --ignore-existing restore/syncash-documents >/dev/null && mc mirror /backup restore/syncash-documents >/dev/null && mc ls restore/syncash-documents >/dev/null'
fi

printf 'Isolated SynCash restore test passed.\n'
