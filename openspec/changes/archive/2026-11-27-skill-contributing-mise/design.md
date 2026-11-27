## Context

`mise.toml` pins the repository's tools. One of them, `packslip:jubr/variant-worktrees`, uses the `packslip:` backend, which mise first shipped in 2026.9.2 (see the compatibility page of packslip). The `min_version` key is mise's own mechanism for that: it is read before tools are resolved and stops older versions with a clear message.

## Goals / Non-Goals

**Goals:**

- A contributor with an old Mise learns to update instead of seeing an unknown-backend error.
- Keep the guide and the skills loadable and accurate.

**Non-Goals:**

- Pinning Mise exactly, or installing Mise for the contributor.
- Changing what `variant init` writes into user projects.

## Decisions

- **Floor, not pin.** The spec requires `min_version` no lower than 2026.9.2, the release that introduced the backend, and never an exact pin of Mise. The repository sets `2026.11.12`, the release it is developed and tested with, above the floor. Alternative: exactly 2026.9.2. Not chosen: the repository is only exercised with the newer release.
- **Top-level key in `mise.toml`**, above `[tools]`, with a comment that names the reason (`for packslip`), so a later edit does not lower it without seeing why. `scripts/mise-config.spec.ts` fails if it drops below the floor.
- **No `node` pin; the runtime spec finds Node itself.** `node-runtime.spec.ts` of `variant-api` asked `mise which node`, which needs a Mise-installed node. It now walks `PATH` for the first `node` that reports no `process.versions.bun`, and uses that process's `process.execPath` (a Mise shim run in a temporary directory has no version set and fails). Alternative: keep the pin. Not chosen: the pin existed only for that call and the npm shims, and `aube` runs the npm tools under `bun`.
- **No workflow change.** CI installs the latest Mise, which is above the floor.
- **Skill front matter and the guide's Cursor paragraph** are prose fixes with no behavior; they ship in the same change since they were already written, and need no spec.

## Risks / Trade-offs

- [A tool added later needs a newer Mise] → raise `min_version` in the same change that adds it; the requirement says it covers every backend in use.
- [`min_version` blocks a contributor whose Mise is slightly old] → intended; the error names the version to install.
