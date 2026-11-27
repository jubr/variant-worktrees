## Why

The branch workflow already compiles `variant` for linux-x64 with the slim Bun runtime, but a reviewer cannot see which slim build went in or how big the result is without downloading anything. Only the release workflow reports sizes, and only after a merge.

## What Changes

- The `Library and CLI under Node` job of `ci-branch.yaml` writes a short Markdown table to its step summary: the `bun-slim` release that was embedded, the size of that runtime, and the size of the compiled `variant`.
- A new script `scripts/slim-summary.ts` renders the table. It needs no network access and no download of the default runtime, unlike `scripts/runtime-sizes.ts`.
- The report never fails the job.

## Capabilities

### New Capabilities

### Modified Capabilities

- `meta/ci-feature-builds`: a feature-branch run reports the embedded slim runtime release and the sizes of the runtime and of `variant`.

## Impact

- `.github/workflows/ci-branch.yaml` (one step), `scripts/slim-summary.ts` and its spec, `scripts/ci-feature-builds.spec.ts`.
- `CONTRIBUTING.md` names the step in its CI list.
