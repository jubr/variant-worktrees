## Why

Play on a variant in the Variants view fails when the editor workspace is the variant root: the directory that holds the `AGENTS.md` symlink into the main checkout and the `_v-*` worktrees, and that is not itself a git checkout. `watch` is started in that directory and reports `Unable to inspect git worktree` there, so a variant that is already listed never starts. A `variants.yaml` symlink in that root is not a fix; it hides the real file. At editor startup the same log channel also fills with one `[title-event] event` line and one `[title-event] decision` line per chat that already existed, both at Debug, which hides the events that matter.

## What Changes

- From the variant root, with no `variants.yaml` of its own, load the real `variants.yaml` in the main checkout the `AGENTS.md` symlink names. `create` and `watch` of an explicit slug from that directory succeed, and git runs in the main checkout.
- A `variants.yaml` that is a symlink in the variant root is an anti-pattern. It is not the configuration. Loading warns and uses the real file in the main checkout.
- A run whose directory is the main checkout resolves the slug to `main`. A run whose directory is a variant worktree resolves the slug of that variant. `${slug}` in that run expands to the same value.
- Play, stop, and implode run with the clicked item's slug and with that item's directory: the variant worktree, or the main checkout for `main`. They do not use the workspace folder when that folder is the variant root. The panel's watch, down, and implode use the same slug and directory.
- Log the startup pair at Trace: the `[title-event] event` line for a chat whose first prompt was submitted before the renamer started listening, and that chat's `[title-event] decision` with reason `before startup`. A title event after startup stays at Debug. A decision that is not `before startup` keeps its current level (`no first prompt` and `too old` stay Debug, a rename, keep, or ordinary ignore stays Info, a failed rename stays Error).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/core`: the variant root is a workspace through the `AGENTS.md` symlink, and a `variants.yaml` symlink there is warned and ignored.
- `variant-api/core`: a run in the main checkout or a variant worktree resolves that slug, and `create` and `watch` from the variant root succeed.
- `variant-vscode/variants-tree`: play, stop, and implode pass the item's slug and directory.
- `chat-renamer/chat-renaming`: the title-event lines for a chat that existed before startup are Trace.

## Impact

- `packages/variant-config` (finding `variants.yaml` from the variant root, and the warning) and `packages/variant-api` (slug resolution, git in `variant.main`, watch commands in the slug's worktree).
- `packages/variant-vscode` (the tree and the panel call watch, down, and implode with the item's directory).
- `packages/chat-renamer-api` and `packages/chat-renamer-vscode` (the `event` line and the `before startup` decision). `packages/chat-renamer-vscode/README.md` today tells the reader to select Debug to see those startup lines.
- The open change `better-logs` still states Debug for the `before startup` decision. This change is the later requirement. Implementation updates the tests that assert Debug. That change's files stay as they are, except the one sentence this change amends so a later archive does not put Debug back.

## Non-goals

- No requirement that the variant root contain a `variants.yaml`, as a file or as a symlink.
- No change to title-event levels for a chat created after startup, including a later title event of a chat.
- No change to `no first prompt`, `too old`, rename, keep, or failure levels.
- No change to existing-chats log lines.
- Watch stays an in-process call from the view. The socket still refuses it.
