#!/usr/bin/env bash
# AIDEV-NOTE: stdin per-commit avoids commitlint --from/--to merge-base crash
# (unrelated histories / shallow clones). Range is still FROM..TO via git rev-list.
set -euo pipefail

FROM_REF="${COMMITLINT_FROM:-origin/main}"
TO_REF="${COMMITLINT_TO:-HEAD}"

if ! git rev-parse --verify "$FROM_REF" >/dev/null 2>&1; then
  echo "commitlint: missing ${FROM_REF} (fetch with: git fetch origin main:refs/remotes/origin/main)" >&2
  exit 1
fi

while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  git log -1 --pretty=%B "$sha" | commitlint
done < <(git rev-list --reverse "${FROM_REF}..${TO_REF}")
