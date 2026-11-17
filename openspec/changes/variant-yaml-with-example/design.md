## Context

The root `variants.yaml` is the repository's dogfood configuration for `variant watch`; `example/variants.yaml` is the
standalone sample, used as a test fixture. The example `fe` already reads `PORT` and `VARIANT_API_PORT` (its Vite config),
and `be` reads `PORT`. Their scripts are `dev` (`bun --bun vite`, which builds on the fly with HMR) and `start:dev`
(`bun --watch --no-clear-screen src/main.ts`, which reloads on change).

## Goals / Non-Goals

**Goals:**
- A committed root `variants.yaml` mirrors the port wiring of `example/variants.yaml`.
- One descriptive script name per app, used everywhere the example runs a watch.

**Non-Goals:**
- Changing the Dockerfiles or the container setup.
- New schema keys, such as a separate `build` command on a watch.
- Changing autodetection: it still looks for `dev` and `start:dev` in other projects.

## Decisions

- **Pure rename, no new commands.** `dev` becomes `app:watch` and `start:dev` becomes `server:watch`, with the same
  command text. Both already compile as they serve and again on every change, so "build and watch" needs no extra
  `build` step. Alternative: prefix `bun run build &&`, rejected because it only delays the first serve.
- **Rename in both `variants.yaml` files** (root and `example/`), so neither references a script that is gone.
- **Autodetect agrees by kind and directory only.** With the scripts renamed, autodetection of the example falls back to
  `bunx --bun vite` and `bunx nest start --watch`; the fixture test compares kinds and directories, which stay equal.
- **`ready` checks** reuse `example/variants.yaml`: `/api` for `example-be`, `/` for `example-fe`.
- **Port wiring copied from the example**, with the root file's own keys: `example-be` before `example-fe`, `VARIANT_API_PORT: '${example-be.port}'` on `example-fe`. Template keys may contain hyphens.
- **The root file is committed on this branch.** It starts untracked in the main checkout; the branch adds it with the ports. Its other settings (`implode`, `chatRenamer`, install commands) stay as they are.
- `build` and `build:watch` stay untouched.

## Risks / Trade-offs

- A missed reference to `dev` or `start:dev` fails at run time → a repo-wide search in the tasks, plus tests that pin
  the script names and both YAML files.
- Autodetection of the example now yields a plainer command than the explicit watch → accepted; the explicit config wins.
- Root YAML and `example/variants.yaml` can drift → tests pin both.
