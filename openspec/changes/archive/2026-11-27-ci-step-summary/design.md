## Context

`package:cli` leaves the slim runtime under `.cache/bun-slim/<platform>/bun-slim-<platform>-v<version>-<build>/bun-slim` and the executable in `out/`. `scripts/runtime-sizes.ts` reads the same places for the release summary, but it also downloads the default runtime from `oven-sh/bun`, which a branch run does not need.

## Goals / Non-Goals

**Goals:**

- Show the embedded `bun-slim` release, its size and the size of `variant` in the step summary of the existing job.

**Non-Goals:**

- The default-runtime comparison of the release table.
- Other targets: a branch compiles linux-x64 only.

## Decisions

- **A script of its own, not a flag of `runtime-sizes.ts`.** The release table has seven columns and a network call. The branch table has three columns and reads files only, so it cannot fail for a missing download. The directory name parse comes from `slimRuntimeRelease` in `scripts/bun-slim.ts`.
- **The release comes from the directory name of the cached runtime.** That is the build `package:cli` embedded, so the table cannot name a newer release than the one in the executable.
- **`continue-on-error: true` on the step**, as in the release workflow: a report must not turn a green gate red.

## Risks / Trade-offs

- [The cache layout changes] → the table shows `–` for the release and runtime size, and the script spec fails on the layout it reads.
