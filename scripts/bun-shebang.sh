#!/usr/bin/env bash
# AIDEV-NOTE: node_modules/.bin/variant is a symlink to packages/variant-api/dist/cli.js, whose
# shebang is `node`. Run it under bun instead. Patch the symlink target in place: `sed --in-place`
# on the link itself would replace the link with a copy. A missing target (not built yet) is fine.
# A rebuild rewrites dist/cli.js, so the build task runs this again.
set -euo pipefail

cd "$(dirname "$0")/.."

target="$(readlink -f node_modules/.bin/variant 2>/dev/null || true)"
[ -f "$target" ] || exit 0

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
sed -e '1s,^#!/usr/bin/env node$,#!/usr/bin/env bun,' "$target" >"$tmp"
# cat > keeps the target's mode; mv would drop the exec bit.
cat "$tmp" >"$target"
