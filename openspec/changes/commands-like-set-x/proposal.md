## Why

`implode` prints the dirty worktree as raw `git status` and `git diff`: no command line, no color (the output is captured), and a three-line-context diff that starts with the `diff --git` preamble. A dirty file is easier to read the way a bash `set -x` trace shows it: a yellow `+` and the command, then a colored one-line-context patch that starts at the `+++` line.

## What Changes

- **BREAKING** for the implode `report` string (progress log, text, JSON, YAML, and the MCP result): the git commands that show the dirty worktree are presented as the equivalent of

  ```bash
  ( export GIT_CONFIG_PARAMETERS="'color.ui=always'" PS4=$'\n\033[0;33m+ \033[0m '; ( set -x; git diff -U1 <path> ) | tail -n+4 )
  ```

  - `git status`, then `git diff --stat`, then one `git diff -U1 <path>` per path that `git diff` lists. Each command with output is preceded by a blank line and a trace line: yellow `+ ` (`\033[0;33m+ \033[0m`), then the command.
  - Color is forced (`color.ui=always`), including when the output is captured.
  - Each patch drops its first three lines (`diff --git`, `index`, `---`), so a modification starts at `+++` and the hunk. A longer header keeps the lines that remain after those three.
  - `maxDiffLines` counts the kept patch lines, not the trace lines. Over the limit, every per-file patch is omitted and status and stat stay.
- The plain `+ <command>` lines of provision, `up`, `down` and `watch` stay as they are.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/implode`: the implode report shows the dirty worktree as traced, colored, one-line-context git commands.

## Impact

- `packages/variant-api` (`worktreeReport` and the implode tests). The CLI, JSON, YAML and MCP already print or return `report`, so they follow the new string.
- `docs/guide/configuration.md` (the `maxDiffLines` row and the implode paragraph), the `maxDiffLines` comment in `packages/variant-config/variants.example.yaml`, and `CHANGELOG.md`.
- Non-goals: a bash `set -x` or `tail` subprocess; changing `echoCommand` for install, `up`, steps and containers; coloring git calls that do not display the dirty tree; showing the contents of untracked files; a new default for `maxDiffLines`; including staged-only changes in the per-file diffs (`git status` still lists them).
