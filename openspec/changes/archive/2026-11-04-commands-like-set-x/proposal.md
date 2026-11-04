## Why

`implode` prints the dirty worktree as raw `git status` and `git diff`: no command line, and a three-line-context diff that starts with the `diff --git` preamble. A dirty file is easier to read as a bash `set -x` trace: a dark-yellow `+` and the command, then a one-line-context patch that starts at the `+++` line.

## What Changes

- **BREAKING** for the implode `report` string (progress log, text, JSON, YAML, and the MCP result). Each git command that shows the dirt is printed by Node as `\n{yellow}+ {cmd}{reset}\n` followed by that command's plain output. `{yellow}` is dark yellow `\033[33m` and `{reset}` is `\033[0m`, so the whole `+ {cmd}` is yellow and the output after it is not.
  - Commands, when their output is non-empty: `git status --porcelain`, then `git diff --stat`, then one `git diff -U1 <path>` per path that `git diff` lists.
  - Git's own color is off. The only ANSI in the report is that trace.
  - Patch lines are dropped by shape, not by counting: a line `diff --git …`, a line `index <hash>..<hash> <mode>`, and a line `--- <file>`. A `+++` line and the hunk stay. The same shapes are dropped wherever they sit, including a later file.
  - `maxDiffLines` counts the kept patch lines, not the trace lines. Over the limit, every per-file patch is omitted and the porcelain status and the stat stay.
- The plain `+ <command>` lines of provision, `up`, `down` and `watch` stay as they are.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/implode`: the implode report shows the dirty worktree as a Node-colored trace plus plain `git status --porcelain` and filtered one-line diffs.

## Impact

- `packages/variant-api` (`worktreeReport` and the implode tests). The CLI, JSON, YAML and MCP already print or return `report`, so they follow the new string.
- `docs/guide/configuration.md` (the `maxDiffLines` row and the implode paragraph), the `maxDiffLines` comment in `packages/variant-config/variants.example.yaml`, and `CHANGELOG.md`.
- Non-goals: a bash `set -x` or `tail` subprocess; `color.ui` or any other coloring done by git; coloring the patch body in Node; changing `echoCommand` for install, `up`, steps and containers; coloring git calls that do not display the dirty tree; showing the contents of untracked files; a new default for `maxDiffLines`; including staged-only changes in the per-file diffs (porcelain still lists them).
