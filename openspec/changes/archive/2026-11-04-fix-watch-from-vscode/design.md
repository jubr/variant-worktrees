## Context

See proposal.md for why. The editor workspace is the variant root. The view builds one client with that folder as `cwd` and Play calls `watch(slug)` on it. The root is not a git checkout, so git reports `Unable to inspect git worktree` for it. Listing still works from `_v-*` directories and `variants.local.yaml`.

The real `variants.yaml` lives in the main checkout. The root's `AGENTS.md` symlink already names that checkout. A `variants.yaml` symlink in the root would be found first by the ancestor walk and would hide the real file. That link is not part of the layout.

`resolveSlug` already returns `main` for the primary checkout and the branch slug for a linked worktree, and it returns before git when a slug is passed. The view never puts the process in the item's directory, so that deduction never sees the checkout Play is about. `${slug}` expands from the operation slug.

The title-event listener writes `event` at debug as the event arrives, then one decision. `before startup`, `no first prompt`, and `too old` share one debug write. The open change `better-logs` still states debug for `before startup`.

## Goals / Non-Goals

**Goals:**

- The variant root resolves through the `AGENTS.md` symlink to the real `variants.yaml`.
- Play, stop, and implode carry the item slug and the item directory, so a run there deduces the same slug the click named.
- `create` and `watch` of an explicit slug from the root succeed, with git in `variant.main` and commands in the slug's worktree.
- The startup `event` and the `before startup` decision are one trace entry each. The shared early-exit write splits so the other reasons stay put.

**Non-Goals:**

- Accepting a `variants.yaml` symlink in the root as configuration.
- Deducing one slug for the whole root when none was given.
- Changing the view's list client away from the workspace folder, or sending watch over the socket.
- Holding the startup burst for a time window. The level follows the prompt timestamp.

## Decisions

**Find the real file from the root.** When the start directory is not a checkout and holds an `AGENTS.md` symlink into a checkout that has a real `variants.yaml`, load that file. `variant.main` and `variant.root` then follow the existing parent-symlink rule, because the file's parent is the root. A `variants.yaml` symlink in the root is skipped and added to the configuration warnings. A real file there stays the configuration. Alternative: depend on the symlink as the config. Rejected, because it is the anti-pattern.

**Actions take the item directory.** Watch, down, and implode from the tree and the panel use `cwd` equal to the record's worktree, or `variant.main` for `main`, and pass the item slug. Inside that directory, slug deduction and `${slug}` match the click. The list client stays on the workspace folder, which is the root and now loads. Alternative: one client pinned to the workspace folder for actions too. Rejected, because that folder is the directory git rejects.

**Root operations use `variant.main` for git.** `create`, `watch`, `down`, and `implode` started in the root, with an explicit slug, inspect git in `variant.main`. `variantConfigDir` rebases from the loaded file, which is inside the checkout, onto the worktree, so a watch command's directory is `<root>/_v-<slug>/<dir>`. No slug from the root still errors. Alternative: catch the git error and skip the command. Rejected, because play would report success without starting the variant.

**Log the first `event` after the prompt time is known.** A session already handled still logs `event` at debug on arrival and returns. The first event is logged from the decision: `trace` for `before startup`, `debug` otherwise, one entry, before any rename. Only `before startup` moves to trace. Alternative: trace for every event during a short startup window. Rejected, because a new chat in that window would lose its debug line.

**Amend the open `better-logs` sentence in place.** Change only the `before startup` decision from debug to trace. Do not archive that change here. Alternative: leave the delta. Rejected, because archiving it afterwards would write debug back into the published spec.

## Risks / Trade-offs

- An `AGENTS.md` symlink that does not point at the main checkout becomes `variant.main` → same rule as today once the file is found; an explicit `variant.main` still overrides it.
- A real `variants.yaml` in the root still wins over the file in the checkout → that is an explicit config, not the symlink; the warning covers only the link.
- Deferring the first `event` line waits on the prompt read the decision already waits on → an empty read still logs `event` at debug with `no first prompt`.
- [Archive order] `better-logs` archived without the sentence edit restores debug → the edit is a task of this change, limited to that reason.

## Migration Plan

No data migration. A `variants.yaml` symlink in the root is left in place and warned about; nothing rewrites it. Rollback is reverting the change. A running editor picks up the watch fix and the log levels on the next extension host reload.

## Open Questions

None.
