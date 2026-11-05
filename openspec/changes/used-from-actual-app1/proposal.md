## Why

Running `variant` inside a variant worktree can still load the primary checkout's `variants.yaml`. When that file has no `watches`, the CLI autodetects `bun run dev` and `bun run start:dev` with no port arguments and no `PORT` override, so the app's dev servers ignore the ports the worktree file already states. The editor then treats a watch as up from the recorded pid alone, and a dirty implode hides the diff the command already computed.

## What Changes

- When the process working directory is inside a variant worktree that has its own `variants.yaml` (or `variants.yml`), that file is the configuration. An ancestor file and an `AGENTS.md` symlink to the primary checkout do not replace it. Explicit watches in that file run as written: a watch env `PORT: ${port}` is set on the process, `VARIANT_<KEY>_PORT` is exported (a watch `spa` yields `VARIANT_SPA_PORT`), and `${api.port}` expands to the other watch's port. Autodetection does not replace those watches.
- **BREAKING:** Stop writing `variants.local.yaml` and `.cache/variants/<slug>.yaml`. Each variant directory gets `.cache/variant/state.yaml` (the minimal record core and the editor need, harvested to find variants, rewritten only when its content changes) and `.cache/variant/runtime.yaml` (the full runtime-detection dump, rewritten only when its content changes). An old file is still read when the new one is absent, and is not written again.
- `db.port` in `variants.yaml` accepts a positive integer or a string, so `${POSTGRES_PORT}` validates in the parser and in the published JSON schema. A string that does not resolve to a positive integer still fails.
- When init detects Postgres from named environment variables, it writes `host`, `port`, `user`, and `password` as `${NAME}` references (password included), and writes `database` as the detected name. It does not write `variant.main` or `variant.root`. `variant config` still prints those two resolved paths.
- The Variants tree, after it starts a watch, shows a loading icon until the recorded pid is alive and a GET of `{url}` joined with that watch's `ready` path returns 200. That check is asynchronous. The first time it succeeds, the tree opens `{url}` in the external browser once. A watch with no `ready` path is not fetched and is not opened.
- A dirty implode shows the same report `variant implode` prints. Diff additions and deletions in that report are ANSI-colored, and the tree writes that colored report to the extension output before the force question.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/core`: worktree file wins over the primary checkout; `db.port` allows a string; `variant config` prints resolved `variant.main` and `variant.root`; runtime state moves to the two cache files.
- `variant-config/cfg-runtime`: port overrides and discovery read `.cache/variant/state.yaml`.
- `variant-api/core`: create, list, and implode use the cache files.
- `variant-api/runtime`: watch and up record state and the detection dump in the cache files, and a worktree file's watches are the ones started.
- `variant-api/status`: status names the state file it read.
- `variant-api/state-watch`: subscription notices follow the state file.
- `variant-api/init`: Postgres connection fields that came from named variables are written as references, including password; `variant.main` and `variant.root` are not written.
- `variant-api/implode`: the report colors added and removed diff lines.
- `variant-vscode/variants-tree`: loading until `{url}` joined with `ready` is 200, then open the URL once; dirty implode shows the colored report.
- `variant-config/cfg-multi-schema`: the recorded runtime file is the state file.
- `variant-cli/config-migration`: the command no longer rewrites `variants.local.yaml`.
- `variant-vscode/config-migration`: the extension no longer rewrites `variants.local.yaml`.

## Impact

- `variant-config` (discovery, schema, JSON schema, local state read/write), `variant-api` (state path, list, watch env, implode report), `variant-vscode` (tree health check, open, implode output).
- User-facing copy in `README.md`, `docs/guide/core.md`, `packages/variant-vscode/README.md`, and `CHANGELOG.md` that names `variants.local.yaml`, `.cache/variants/<slug>.yaml`, `db.port`, or the dirty-implode notification.
- Existing worktrees keep listing from the old files until the next write. New writes do not recreate those files.

Non-goals: changing autodetected `bun run dev` / `bun run start:dev` when the loaded file has no watches; moving `variants.watch.log`; a JSON schema for the cache files; opening a URL for a watch the tree did not start; writing MySQL or MariaDB host, port, and user as references; imploding `main`.
