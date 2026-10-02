#!/usr/bin/env bash
set -euo pipefail

# Builds a SynCash Production release artifact directly from Git's object
# database for an exact commit, then verifies every extracted file's content
# hash against the Git blob recorded for that commit before ever writing the
# final archive. This makes the artifact byte-identical to what is committed
# regardless of the building machine's core.autocrlf/core.eol settings.
#
# Usage: scripts/build-release-artifact.sh <git-sha> <output.tar.gz>

SHA="${1:?Usage: $0 <git-sha> <output.tar.gz>}"
OUTPUT="${2:?Usage: $0 <git-sha> <output.tar.gz>}"

if ! git rev-parse --verify "${SHA}^{commit}" >/dev/null 2>&1; then
  printf 'Not a valid Git commit: %s\n' "$SHA" >&2
  exit 1
fi

TMP_DIRECTORY="$(mktemp -d)"
cleanup() { rm -rf -- "$TMP_DIRECTORY"; }
trap cleanup EXIT

# Force byte-exact export regardless of this machine's line-ending config;
# .gitattributes (eol=lf on tracked source/text types) is the primary defense,
# these flags are a second, independent layer.
git -c core.autocrlf=false -c core.eol=lf -c core.safecrlf=false \
  archive --format=tar "$SHA" | tar -x -C "$TMP_DIRECTORY"

mismatches=0
while IFS=$'\t' read -r _mode type object path; do
  [ "$type" = "blob" ] || continue
  # --no-filters is essential: without it, git hash-object re-applies the
  # clean filter (CRLF -> LF) before hashing, which would silently mask the
  # exact corruption this check exists to catch.
  actual="$(git hash-object --no-filters "$TMP_DIRECTORY/$path")"
  if [ "$object" != "$actual" ]; then
    printf 'MISMATCH: %s (expected blob %s, extracted file hashes to %s)\n' "$path" "$object" "$actual" >&2
    mismatches=$((mismatches + 1))
  fi
done < <(git ls-tree -r "$SHA")

if [ "$mismatches" -gt 0 ]; then
  printf 'Release artifact verification FAILED: %d file(s) differ from their Git blob. Refusing to produce artifact.\n' "$mismatches" >&2
  exit 1
fi

tar -czf "$OUTPUT" -C "$TMP_DIRECTORY" .
printf 'Release artifact verified byte-identical to %s and written to %s\n' "$SHA" "$OUTPUT"
