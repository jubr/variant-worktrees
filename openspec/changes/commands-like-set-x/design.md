## Context

See [proposal.md](proposal.md) for why. The report is built in `worktreeReport` (`packages/variant-api/src/cleanup.ts`): three `git()` calls (`status`, `diff --stat`, `diff`), joined when non-empty, then logged and returned on the implode result. `git()` captures stdout, so git turns color off. The CLI, JSON, YAML and MCP all surface that same `report` string. The plain `+ <command>` progress lines go through `echoCommand` and are a different surface.

Behavior contract: [specs/variant-api/implode](../../specs/variant-api/implode/spec.md).

## Goals / Non-Goals

**Goals:**

- Produce the report string in process, with the same bytes a reader sees in the progress log and in `report`.
- Keep `echoCommand` and the commands it prints unchanged.

**Non-Goals:**

- See proposal.md. Also out of scope: stopping the report from being logged and printed again in the text layout (it already is both).

## Decisions

### Build the trace in TypeScript, do not spawn bash

`set -x` writes the trace to stderr and the diff to stdout, and the screenshot's `tail -n+4` only sees stdout. A shell wrapper would have to splice those streams and quote every path. `worktreeReport` instead runs git and concatenates a trace line with the sliced stdout. That is the same picture, and a path cannot break the shell.

Alternative: `sh -c` of the wrapper. Rejected for quoting and for the two streams.

### Force color with `git -c color.ui=always`

`runGit` already invokes `git -C <worktree> …`, so `-c color.ui=always` goes in front of the subcommand (`status`, `diff`). Color stays on when stdout is a pipe. This is the same switch as `GIT_CONFIG_PARAMETERS="'color.ui=always'"` without that variable's quoting, and it does not change git config for anything else in the process.

The ANSI sequences stay in the report string. Stripping them for JSON would make the text layout diverge from the result it is derived from, and the progress log would be plain while the screenshot is colored.

### One yellow plus, one space

The trace line is `\033[0;33m+ \033[0m` immediately followed by the command, and each command is preceded by a blank line (the leading newline of that `PS4`). The screenshot's `PS4` is `\n\033[0;33m+ \033[0m `, which paints `+` and a space yellow and then adds a second space after the reset. The report uses one space, the colored one, so the line reads like bash `PS4='+ '` with the plus painted yellow.

The displayed diff command is `git diff -U1 <path>` with no `--`. The invocation still passes `--` before the path so a path that looks like a flag is not parsed as one. Paths from `git diff --name-only` do not start with `-`, and the scenarios use `src/a.ts`. A path that contains whitespace is quoted in the trace so the echoed text is still one command.

### Per-file `-U1`, drop the first three lines, gate on that text

`git diff --name-only` supplies the paths, in that order. Each patch is `git diff -U1 -- <path>` with color on; the first three lines are removed and the rest kept. For a normal modification, line four is the `+++` line whether or not the user has `diff.noprefix`. No `--no-prefix` or `--src-prefix` is passed, so a user's prefix config still applies.

`maxDiffLines` counts those kept lines across every file, not the trace lines and not a default-context `git diff`. All of the patches are included when the count is at most the limit, and none of them when it is over. Status and stat are not part of the count. Counting the old three-line-context diff would let the setting describe a size the user no longer sees.

### Leave `echoCommand` alone

The dirty report is a returned string, not a progress line before an unrelated command. Routing it through `echoCommand` would color every provision and container line, which this change does not do.

## Risks / Trade-offs

- [Consumers that search `report` for `diff --git`] → The changelog marks the report body breaking. `modified:` and `file changed` in the status and stat text stay.
- [`maxDiffLines` now counts the shorter `-U1` patch, so a diff that used to be omitted can be shown] → The configuration guide states that the count is the kept patch lines. The default stays 200.
- [A header longer than three lines (new file, rename, mode change) still shows its leftover lines, including a `---` line] → Same cut as `tail -n+4`. The requirement allows it. No extra parser for header shapes.
- [ANSI in JSON and MCP] → Accepted. The report is display text. Rollback is reverting the change; nothing is stored.

## Migration Plan

No data migration and no config key change. Ship the report change with a breaking note under `## Unreleased` in `CHANGELOG.md`. Rollback is reverting the commit; old reports are not persisted.

## Open Questions

None. The trace spacing, the color switch, and what `maxDiffLines` counts are decided above.
