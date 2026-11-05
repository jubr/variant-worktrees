## Context

See proposal.md for why. Config discovery walks ancestors, then an `AGENTS.md` symlink into the primary checkout. Operational state is split between `variants.local.yaml` in the variant directory and `.cache/variants/<slug>.yaml` under the configuration directory. `db.port` is an integer in the Zod schema and the published JSON schema. The tree treats a recorded pid as enough to show a watching row. The implode report colors only the `+ command` traces.

## Goals / Non-Goals

**Goals:**

- One load rule: a `variants.yaml` inside the worktree that contains the working directory is the file that runs.
- One cache directory per variant, `.cache/variant/`, with a small harvested state file and a detection dump, both rewritten only when the text changes.
- `db.port` accepts `${POSTGRES_PORT}`. Init writes the Postgres connection references, including password, and still omits `variant.main` and `variant.root`.
- The tree confirms a watch it started with pid plus `{url}/health`, then opens the URL once.
- Dirty implode shows the same ANSI report the command prints, with added and removed diff lines colored.

**Non-Goals:**

- Changing autodetected watch commands when the loaded file has no `watches`.
- Moving `variants.watch.log`.
- A JSON schema for the cache files.
- Opening a URL the tree did not start.
- Using a watch `ready` path for the tree check.
- Writing MySQL or MariaDB host, port, and user as references.

## Decisions

1. **Clamp discovery to the worktree.** When the start directory's git toplevel is a linked worktree (not the primary), ancestor search stops at that toplevel if `variants.yaml` or `variants.yml` is there. The `AGENTS.md` fallback does not run in that case. A worktree with no config file keeps today's walk. Rejected: always loading the primary checkout's file and rebasing paths, which is what drops the worktree's watches.

2. **Two files, one directory.** `state.yaml` is the harvest record (`slug`, `createdAt`, `dir`, `dialect`, `target`, and when known `mode`, `log`, `watches`). `runtime.yaml` is the resolved detection dump (database settings, watch commands, configuration path). List, status, the tree, and port reuse read `state.yaml`. Writers compare the serialized YAML and skip the write when it matches, so `changedMs` and the subscription stay quiet. Serialize with a stable key order. Rejected: keeping `variants.local.yaml` as a third file.

3. **Legacy read, no legacy write.** If `state.yaml` is missing, readers accept `variants.local.yaml` in that directory and `.cache/variants/<slug>.yaml` for that slug. Create, watch, up, and down write only the new paths. Implode deletes the new files and does not recreate the old ones. The CLI and the extension stop rewriting `variants.local.yaml`.

4. **`db.port` is integer or string at the schema, integer after resolve.** The Zod field and the generated JSON schema allow both. A digit string or a single `${NAME}` passes validation; expansion uses the same environment pass as other settings and must yield a positive integer. `not-a-number` still fails. Init, for Postgres only, writes `host`, `port`, `user`, and `password` as `${NAME}` with the existing `# from` comment, and writes `database` as the detected name. `variant.main` and `variant.root` stay out of the file; `variant config` already prints the resolved object, and the command must keep those two fields in the JSON.

5. **Tree check is a side loop.** Play records the slug as started by this view. After the detached watch returns, the row stays on `loading~spin` until `process.kill(pid, 0)` succeeds and `GET {url}/health` returns 200. The fetch does not run inside `getChildren`. On that transition, `openExternal` runs once. A row already healthy at load is not opened. No URL means no fetch and no open. The health path is `{url}/health`, not the watch `ready` setting.

6. **Color the diff in the report string.** Git color stays off. After the existing plain `git diff -U1` body is trimmed, wrap hunk lines that start with `+` (not `+++`) in green and lines that start with `-` in red. Traces stay yellow. The tree asks for that report string without calling `implode`, writes it to the extension output channel (which renders ANSI), then shows the existing force notification.

## Risks / Trade-offs

- [A watch with no `/health` stays on the loading icon while its pid lives] → The spec requires that. Stopping the watch, or the pid exiting, leaves the loading icon.
- [Unstable YAML key order makes every write look new] → One serializer and a byte compare before write.
- [An old checkout has only `variants.local.yaml`] → Readers still list it; the next create, watch, or up writes the new files.
- [Clamping hides a primary-checkout file when the worktree also has one] → That is the point of the rule. A worktree with no file still falls through.
- [Previewing the implode report must not delete the worktree] → The report function is the one implode already runs before removal, called on its own.

## Migration Plan

Readers grow the legacy fallback first, then writers switch to `.cache/variant/`. Existing worktrees keep appearing. Rollback is reverting the change: old files that were not deleted are still readable by the previous version; new files are ignored by it. Do not delete a legacy file during rollback.

## Open Questions

None.
