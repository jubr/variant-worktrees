## Context

See [proposal.md](proposal.md) for why. `cli.ts` strips `--log-level` and `--json` / `--yaml` from `argv` before `cleye` runs. `attachLogLevel` then calls `loadConfig` with `process.cwd()`, and the command client loads configuration from that same directory. A flag handled inside `cleye` is too late: configuration has already been read.

`withGlobalFlags` copies the command's flag table into a `Global flags` section. That table's breakpoint for a terminal wider than 40 columns and no wider than 80 sets `paddingBottom: 1` on the description column, which inserts an empty line after every row. The wider breakpoint does not. The global section must not keep that padding. Command `Flags` tables stay on the stock breakpoints.

Completion flags are `FlagModel` values with a required `long` name. Shell emitters always print `--${long}`. `outputFlags` are added to lifecycle commands only. `--json` stays off `ui` and `completions`.

## Goals / Non-Goals

**Goals:**

- One argv scan that changes directory before `attachLogLevel` and before `cleye`.
- A global-flags table whose columns have `paddingBottom` 0 at every breakpoint.
- A short-only completion flag, offered at the top level and on every subcommand, including `ui` and `completions`.

**Non-Goals:**

- Completing the path. The flag is offered; the directory is typed.
- Changing the command `Flags` table.
- A long option used only so the completion model or `cleye` has a name.

## Decisions

### Scan `-C` before configuration

A function in the same style as `takeLogLevel` walks `argv` once, left to right. A token `-C` consumes the next token as the path. A token longer than `-C` that starts with `-C` uses the remainder, so `-C/tmp` is `/tmp` and `-C=path` is the path `=path` (no separate `=` form). Each path is applied with `process.chdir` immediately, so a later relative `-C` resolves from the directory the previous one selected. The returned argv is what `takeLogLevel` and `takeFormat` see.

The scan runs before `attachLogLevel`. `cleye` never receives `-C`, so `strictFlags` does not reject it and no command grows a long name. `--chdir` is left in argv and fails as an unknown flag.

A missing next token, or a `chdir` that fails, throws. The existing `catch` in `cli.ts` prints the message on standard error and sets a non-zero status. The message contains `-C` and, when a path was present, that path. `chdir` is not attempted after a missing value, and `loadConfig` is not called on that path.

Alternative: register `-C` on every `cleye` command and `chdir` in the handler. Rejected: the handler runs after `attachLogLevel` has already loaded configuration from the old directory. Alternative: a `--chdir` long name with alias `C`. Rejected: the option has no long form.

### Short-only help row, no bottom padding

The global section gets its own breakpoint map. Start from the command flag table's breakpoints when that table has them; otherwise use the same three breakpoints the flag table uses (`> 80`, `> 40`, `> 0`). Set `paddingBottom` to 0 on every column. Do not share column objects with the command table if mutating them would change that table. The `> 0` entry is `{ stdoutColumns, columns }`, not a bare array; zero the columns inside it.

The `-C` row is built for the help renderer, not by `cleye`. It shows `-C` in the short-option position, then `<path>`, and no long name. The description says the directory changes before configuration is read. The row is the first row of the global section.

`terminal-columns` reads `process.stdout.columns` (unset means the wide layout). Tests render help with columns unset, at 60, and at 120. The assertion walks the flag lines of the global section itself. The existing section helper stops at the first empty line, so it cannot see a blank line between later flags.

Alternative: drop `paddingBottom` inside `cleye`'s stock map for every flag table. Rejected: command `Flags` sections keep their current spacing.

### Short-only completion flag

`FlagModel.long` becomes optional. A flag still has a long name, a short name, or both. Emitters:

- bash word lists include `--long` only when `long` is set, and `-C` on the top-level flag list next to `--help`
- fish prints `-l` only when `long` is set, and a top-level `-s C` next to `--help`
- zsh with only a short name is `'-C+[description]'`, with no `--chdir` in the exclusion group

One shared flag value is appended in `describeCli` for every command, including `ui` and `completions`. It is not part of `outputFlags`.

Alternative: keep `long: "chdir"` and hide it in the emitters. Rejected: the scripts would still contain `--chdir` unless every emitter special-cased that string.

## Risks / Trade-offs

- [In-process `chdir` leaks into a test that parses argv in the test process] → Behavior tests run the CLI in a child. A direct unit test restores `process.cwd()` in `finally`.
- [A future command flag `-C` is eaten by the scan] → No command uses `-C`. The scan is the only definition of the option.
- [Assigning `stdout.columns` in a test changes later tests] → Restore the previous value in `finally`.
- [Zeroing padding fixes the 41–80 column blank line, and a wide layout could still carry an empty line from the row data] → The columns-120 render is part of the same assertion. If that render still has an empty line, the extra line is in the global rows and is removed there.

## Migration Plan

No data migration and no configuration change. Rollback is reverting the commit. Callers that have not started using `-C` are unaffected. `--json` and `--yaml` stay off `ui` and `completions`.

## Open Questions

None.
