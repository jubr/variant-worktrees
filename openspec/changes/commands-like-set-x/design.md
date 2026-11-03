## Context

See [proposal.md](proposal.md) for why. The report is built in `worktreeReport` (`packages/variant-api/src/cleanup.ts`): three `git()` calls (`status`, `diff --stat`, `diff`), joined when non-empty, then logged and returned on the implode result. `git()` captures stdout. The CLI, JSON, YAML and MCP all surface that same `report` string. The plain `+ <command>` progress lines go through `echoCommand` and are a different surface.

Behavior contract: [specs/variant-api/implode](../../specs/variant-api/implode/spec.md).

## Goals / Non-Goals

**Goals:**

- Produce the report string in process, with the same bytes a reader sees in the progress log and in `report`.
- Keep `echoCommand` and the commands it prints unchanged.

**Non-Goals:**

- See proposal.md. Also out of scope: stopping the report from being logged and printed again in the text layout (it already is both).

## Decisions

### Build the trace in TypeScript, do not spawn bash

`set -x` writes the trace to stderr and the diff to stdout. A shell wrapper would have to splice those streams and quote every path. `worktreeReport` runs git and prefixes the stdout. A path cannot break the shell.

Alternative: `sh -c` of the wrapper. Rejected for quoting and for the two streams.

### Color only the trace, in Node

Dark yellow is `\033[33m` (ANSI yellow, not bright `\033[93m` and not bold `\033[1;33m`). Reset is `\033[0m`. Each kept command is this string followed by the command's stdout:

```text
\n\033[33m+ <command>\033[0m\n
```

The `+` and the command are both inside the yellow. The output after the reset is not. Git is run with `-c color.ui=never`, so a user's `color.ui=always` cannot paint the pipe and cannot hide a header inside ANSI. The `-c` switch is not part of the traced command. The traced text is `git status --porcelain`, `git diff --stat`, or `git diff -U1 <path>`.

Alternative: `git -c color.ui=always` and a yellow plus only. Rejected. The color belongs to Node, and porcelain plus a filtered patch should stay plain text.

### Filter header lines by shape

After `color.ui=never`, split the patch on newlines and drop a line when it matches one of:

- `diff --git ` at the start of the line
- `index <hex>..<hex> <mode>` (`^index [0-9a-f]+\.\.[0-9a-f]+ `)
- `--- ` at the start of the line (the old-file header, including `--- /dev/null`)

Anything else stays, including `+++`, hunks, `new file mode`, `deleted file mode`, `rename from`, `rename to`, and `similarity index`. Dropping "the first three lines" is rejected: a second file, a rename, or a new file would keep or lose the wrong lines.

The displayed diff command is `git diff -U1 <path>` with no `--`. The invocation still passes `--` before the path so a path that looks like a flag is not parsed as one. A path that contains whitespace is quoted in the trace.

### Porcelain status, then stat, then one patch per path

`git status --porcelain` replaces human `git status`. Empty stdout skips that command, so a clean worktree has no status block. `git diff --name-only` supplies the paths, in that order. Each patch is `git diff -U1 -- <path>`.

`maxDiffLines` counts kept patch lines across every file, after the filter, not the trace lines and not a default-context `git diff`. All of the patches are included when the count is at most the limit, and none of them when it is over. Status and stat are not part of the count.

### Leave `echoCommand` alone

The dirty report is a returned string, not a progress line before an unrelated command. Routing it through `echoCommand` would color every provision and container line, which this change does not do.

## Risks / Trade-offs

- [Consumers that search `report` for `diff --git`, `On branch`, or `modified:`] → The changelog marks the report body breaking. Porcelain uses ` M`, `M `, `??`. The stat line `file changed` stays.
- [`maxDiffLines` now counts the shorter filtered `-U1` patch, so a diff that used to be omitted can be shown] → The configuration guide states that the count is the kept patch lines. The default stays 200.
- [A `---` line that is file content] → A deleted line is prefixed with a single `-`, so the content `--- file` is stored as `---- file` and is kept. Only a header that starts with `--- ` is dropped.
- [ANSI in JSON and MCP, limited to the trace] → Accepted. The report is display text. Rollback is reverting the change; nothing is stored.

## Migration Plan

No data migration and no config key change. Ship the report change with a breaking note under `## Unreleased` in `CHANGELOG.md`. Rollback is reverting the commit; old reports are not persisted.

## Open Questions

None. The trace color, the header filter, and porcelain status are decided above.
