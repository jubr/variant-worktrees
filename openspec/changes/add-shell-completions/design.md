## Context

The CLI in `packages/variant-api/src/cli.ts` builds its cleye subcommands from the shared `commands[]` list (`commands.ts`) plus a CLI-only flag table (`CLI_ONLY_FLAGS`, currently only `list --table`). `commands[]` is also the source of MCP tools and webview forms, and its `name` is typed `keyof VariantClient`. Flags and aliases come from each command's `args` (`ArgDefinition.short` is the alias). `--help` and `--version` are cleye globals. The CLI also checks the first non-flag argument against `commands[]` to report unknown commands before cleye runs. See proposal.md for motivation.

The CLI ships three ways: from source, built `dist/`, and a `bun build --compile` single-file executable, so the feature cannot depend on files next to the binary.

## Goals / Non-Goals

**Goals:**

- Scripts for `zsh`, `bash`, `fish` that cannot drift from the real command and flag set.
- Zero work at completion time and zero work at load time: no process spawn, no config, DB, or git access.
- Works identically from source, `dist/`, and the compiled executable.

**Non-Goals:**

- Dynamic completion of values (slugs). See proposal non-goals.
- A generic completion framework or a new dependency.

## Decisions

**`completions` is a CLI-only command, outside `commands[]`.** `commands[]` entries are lifecycle operations typed against `VariantClient` and exposed over MCP and the webview. Completions are a shell integration with no meaning for either. It is registered next to the mapped commands in `cli.ts` as its own cleye command with a positional `<shell>`. The unknown-command check takes the union of `commands[]` names and `completions`. Alternative: add it to `commands[]` with a flag to hide it from MCP and webview; rejected because it would need a fake `VariantClient` method and filters in two other packages.

**Generate from a description model, not from cleye internals.** A small `describeCli()` in `completions.ts` returns `{ name, description, flags: [{ long, short?, description }] }[]` for every subcommand, built from `commands[]` (via `flagsFor`-equivalent logic: each `arg` becomes a flag with its `short`) plus the CLI-only flags plus `completions` itself. Three string generators render this one model. The flag table `CLI_ONLY_FLAGS` moves from `cli.ts` to a small shared module so the CLI and the generator read the same object. Alternative: parse `variant --help` output at generation time; rejected as fragile and it would spawn work. Alternative: introspect cleye's command objects; rejected because cleye does not expose a stable public shape for that.

**Static scripts, no callback into `variant`.** Each script embeds the full command/flag tables. Tab-completion cost is the shell's own, with no Bun/Node start-up per keypress. The price is that a user must regenerate the script after upgrading `variant`; the docs say so. Alternative: scripts that call `variant __complete` at each TAB; rejected for latency, and because it needs a hidden command.

**Shell specifics.**

- `zsh`: a `#compdef variant` function `_variant` using `_arguments` and `_describe` with descriptions. The script ends with the usual dual-mode guard (`if [ "$funcstack[1]" = "_variant" ]; then _variant "$@"; else compdef _variant variant; fi`), so it works both as an autoloaded file in `$fpath` and under `eval "$(variant completions zsh)"` after `compinit`.
- `bash`: a plain function `_variant` using `COMPREPLY=($(compgen -W ...))` with a `case` on the subcommand, registered with `complete -F _variant variant`. No dependency on `bash-completion`.
- `fish`: `complete -c variant` lines using `__fish_use_subcommand` / `__fish_seen_subcommand_from`, with `-d` descriptions, `-s`/`-l` for short and long flags, and `-f` to suppress file completion where only fixed values apply. Flags are scoped per subcommand.

**Output and errors.** The script goes to stdout through the same path as other output, but unlike lifecycle commands it is printed raw (not JSON). The shell argument is validated before anything else; a missing or unknown value throws the existing error style (`Unsupported shell: <x>. Supported shells: zsh, bash, fish.`), which the top-level handler prints to stderr with exit code 1. The command does not call `createClient`, which is what keeps it independent of config, DB, and git.

**Tests follow the TDD order.** High-level first: run the CLI entry (as `test/cli.test.ts` does) with `completions <shell>` and assert stdout, exit code, and error cases. Then coverage tests iterate `commands[]` and assert every name and flag appears per shell, plus a negative scenario (`--table` not on `create`). A load smoke test runs each script through its real shell (`bash`, `zsh`, `fish`) when that shell is installed and is skipped otherwise, so CI on a machine without fish stays green while the check still runs where possible.

## Risks / Trade-offs

- [Script goes stale after an upgrade] → Documented: regenerate on upgrade; the `eval`/`source` forms regenerate on every shell start.
- [Quoting bugs for descriptions with `'`, `:`, or `$`] → Descriptions are escaped per shell in one helper each; a test feeds a description containing those characters through every generator.
- [Shell not installed in CI, so load tests skip] → The string-level coverage tests always run; the smoke tests run wherever the shell exists, including the contributor's machine.
- [`CLI_ONLY_FLAGS` move touches `cli.ts` behavior] → Pure move; existing `cli.test.ts` covers `list --table` and stays green.

## Migration Plan

Additive. No migration, no config change. Rollback is removing the command; nothing persists on the user's machine unless they chose to save the script.
