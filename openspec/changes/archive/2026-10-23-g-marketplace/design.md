## Context

The `publish` job in `.github/workflows/publish-extensions.yaml` runs `actions/download-artifact` into `vsix/`, then `actions/checkout@v4`. Checkout cleans the workspace of untracked files before fetching, so `vsix/` is deleted and the publish loop receives the literal glob `vsix/*.vsix`. See proposal.md - Why.

## Goals / Non-Goals

**Goals:**

- Keep the downloaded `.vsix` files until both registries have been contacted.
- Fail fast with a clear message when the publish directory holds no `.vsix`.

**Non-Goals:**

- Restructuring the `validate`/`publish` job split or the approval environment.
- Publishing from a rebuilt artifact.

## Decisions

- **Order steps: checkout, mise setup, then download-artifact.** Download after checkout so nothing cleans it. Alternative: download into a path outside the workspace (`$RUNNER_TEMP`); rejected as a larger change touching both publish steps, while reordering is a pure move.
- **Add a guard step before the first publish.** Count `vsix/*.vsix` and exit with `::error::` when zero, so a missing glob can never reach `vsce`/`ovsx` as a literal path. Alternative: `shopt -s nullglob` in each loop; rejected as it would silently publish nothing.

## Risks / Trade-offs

- [The workflow only runs on manual dispatch with a protected environment, so a regression is found late] → Validate with `task lint:workflows`; confirm by dispatching with `registry: openvsx` or a dry check of the guard on a release tag after merge.
