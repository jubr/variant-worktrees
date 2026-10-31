## Context

The CLI in `packages/variant-api/src/cli.ts` builds its cleye subcommands from the shared `commands[]` list (`commands.ts`) plus a CLI-only flag table (`CLI_ONLY_FLAGS`, currently only `list --table`). `commands[]` is also the source of MCP tools and webview forms, and its `name` is typed `keyof VariantClient`. Flags and aliases come from each command's `args` (`ArgDefinition.short` is the alias). `--help` and `--version` are cleye globals. The CLI also checks the first non-flag argument against `commands[]` to report unknown commands before cleye runs. See proposal.md for motivation.

The CLI ships three ways: from source, built `dist/`, and a `bun build --compile` single-file executable, so the feature cannot depend on files next to the binary.

## Goals / Non-Goals

**Goals:**

- Scripts for `zsh`, `bash`, `fish` that cannot drift from the real command and flag set.
- Zero work at load time: sourcing a script runs no `variant` process. At completion time, only a slug position runs `variant`, and it reads local files only: no database, no git, no writes.
- Works identically from source, `dist/`, and the compiled executable.

**Non-Goals:**

- Slugs known only to the database. See proposal non-goals.
- A generic completion framework or a new dependency.

## Decisions

**`completions` is a CLI-only command, outside `commands[]`.** `commands[]` entries are lifecycle operations typed against `VariantClient` and exposed over MCP and the webview. Completions are a shell integration with no meaning for either. It is registered next to the mapped commands in `cli.ts` as its own cleye command with a positional `<shell>`. The unknown-command check takes the union of `commands[]` names and `completions`. Alternative: add it to `commands[]` with a flag to hide it from MCP and webview; rejected because it would need a fake `VariantClient` method and filters in two other packages.

**Generate from a description model, not from cleye internals.** A small `describeCli()` in `completions.ts` returns `{ name, description, flags: [{ long, short?, description }] }[]` for every subcommand, built from `commands[]` (via `flagsFor`-equivalent logic: each `arg` becomes a flag with its `short`) plus the CLI-only flags plus `completions` itself. Three string generators render this one model. The flag table `CLI_ONLY_FLAGS` moves from `cli.ts` to a small shared module so the CLI and the generator read the same object. Alternative: parse `variant --help` output at generation time; rejected as fragile and it would spawn work. Alternative: introspect cleye's command objects; rejected because cleye does not expose a stable public shape for that.

**Static tables, one dynamic callback for slugs.** Each script embeds the full command/flag tables, so completing a subcommand or flag costs only the shell's own work. The one exception is a slug position, where the script runs `variant completions --list-slugs 2>/dev/null` and offers its lines. The price of the static tables is that a user must regenerate the script after upgrading `variant`; the docs say so. Slugs are not embedded because variants are created and removed constantly; an embedded list would be stale within minutes. Alternatives: a hidden `variant __complete` entry point that answers every TAB (rejected: a process start per keypress for data that rarely changes, and a hidden command); a script regeneration hook after `create` and `implode` (rejected: writes into the user's shell setup).

**Prefetch into a stale-while-revalidate cache.** A completion request at any position of the command line checks the stored list for the current directory and, when it is missing or older than 30 seconds, starts `variant completions --list-slugs` detached in the background, so the list is ready by the time the user reaches `-s`. At a slug position the stored list is offered at once, fresh or not, and a stale one triggers a refresh; with no stored list the script calls the listing synchronously, which keeps the "-s TAB as the first TAB" case correct at the cost of one slow completion. Details that make it safe:

- *Where.* `${XDG_CACHE_HOME:-$HOME/.cache}/variant/completions/`, created with mode 0700, file named by a checksum of `$PWD`. Not `/tmp`: a predictable name in a shared directory would let another user plant candidates that end up on the command line. Variants belong to a project, not a directory, so keying by `$PWD` costs an extra refresh in a subdirectory but cannot offer another project's slugs.
- *Atomic write.* The refresh writes `<file>.<pid>` and renames it over the cache, so a reader never sees a partial list. A `<file>.pending` marker younger than 10 seconds suppresses duplicate refreshes from repeated TABs. Concurrent refreshes are otherwise harmless because the rename is atomic.
- *Freshness.* A fixed 30 second window. Longer would miss newly created variants; shorter would spawn a process on most TAB bursts. The result of an empty listing (outside a project) is stored too, so a non-project directory does not spawn a process on every keypress.
- *Detaching per shell, silent.* bash: `( variant completions --list-slugs ... & )` in a subshell so no job number prints. zsh: the `&!` form, which disowns immediately. fish: `command variant ... &` followed by `disown`. All three redirect stdin, stdout, and stderr away from the terminal. The smoke tests assert nothing is printed and no job remains.
- *No prefetch at load.* Sourcing the script still starts nothing. Prefetching at shell start would add a process to every new terminal, including ones that never use `variant`; the first TAB on `variant` is the signal that it is needed.

Alternatives: a long-lived background daemon per shell (rejected: lifecycle and cleanup for a few milliseconds of saving); an in-memory cache in a shell variable filled by a background job (rejected: a background process cannot set the parent shell's variables, and `coproc`/`zle -F` mechanics differ and are fragile per shell); invalidating the cache from `variant create` and `implode` (rejected: those run in other processes and would need to know every cache file, for a freshness window that already bounds staleness to 30 seconds).

**Slug listing is a flag of `completions`, reading local files only.** `--list-slugs` is a boolean flag on the existing command, so there is no hidden subcommand and `<shell>` becomes optional only with it. It unions two sources: saved variant states (`stateSlugs` over the state directory) and directory names starting with `variant.prefix` below `variant.root` (prefix stripped), which also finds worktrees that were never provisioned. It does not call `createClient`, because that creates the state directory and a database adapter. The state directory path is computed by the same rule as `createClient` (`<configDir>/.cache/variants`), extracted into one helper both use so they cannot diverge. The database is skipped on purpose: `list` asks it, but completion must stay fast and work with the database down; a variant that exists only as a database schema with no state and no worktree is not offered. Directory names that are not valid slugs are skipped, so a stray `_v-foo bar` directory cannot put a word with a space on the command line. Any failure (no project, invalid config) is caught and yields empty output and exit code 0, so a TAB in an unrelated directory never prints an error into the prompt. `main` is not listed; it is derived from the primary checkout, not a variant that exists on disk. Alternative: reuse `list` and parse its JSON; rejected because it connects to the database.

**Shell specifics.**

Slug-taking subcommands are the ones whose definition has a `slug` argument; the model carries that as a per-subcommand `takesSlug` so the generators never hard-code the list.

- `zsh`: a `#compdef variant` function `_variant` using `_arguments` and `_describe` with descriptions; `--slug`/`-s` and the optional first positional use a `_variant_slugs` helper that fills candidates with `compadd` from the listing. The script ends with the usual dual-mode guard (`if [ "$funcstack[1]" = "_variant" ]; then _variant "$@"; else compdef _variant variant; fi`), so it works both as an autoloaded file in `$fpath` and under `eval "$(variant completions zsh)"` after `compinit`.
- `bash`: a plain function `_variant` using `COMPREPLY=($(compgen -W ...))` with a `case` on the subcommand, registered with `complete -F _variant variant`. No dependency on `bash-completion`. A slug is offered when the previous word is `--slug` or `-s`, or when the subcommand takes a slug and the current word does not start with `-`.
- `fish`: `complete -c variant` lines using `__fish_use_subcommand` / `__fish_seen_subcommand_from`, with `-d` descriptions, `-s`/`-l` for short and long flags, and `-f` to suppress file completion where only fixed values apply. Flags are scoped per subcommand. `--slug`/`-s` take the listing as their argument, and slug-taking subcommands offer it for the positional.

**Output and errors.** The script goes to stdout through the same path as other output, but unlike lifecycle commands it is printed raw (not JSON). Without `--list-slugs`, the shell argument is validated before anything else; a missing or unknown value throws the existing error style (`Unsupported shell: <x>. Supported shells: zsh, bash, fish.`), which the top-level handler prints to stderr with exit code 1. The command does not call `createClient`, which is what keeps it independent of the database and free of side effects; only `--list-slugs` loads the configuration, and it swallows load errors.

**Tests follow the TDD order.** High-level first: run the CLI entry (as `test/cli.test.ts` does) with `completions <shell>` and assert stdout, exit code, and error cases. Then coverage tests iterate `commands[]` and assert every name and flag appears per shell, plus a negative scenario (`--table` not on `create`). Slug listing tests build a temporary project (state files, `_v-*` directories, a custom prefix) and assert the listing, the absence of side effects (no state directory created), and empty output outside a project. Slug completion tests check each script wires `--list-slugs` only into slug positions. A load smoke test runs each script through its real shell (`bash`, `zsh`, `fish`) when that shell is installed and is skipped otherwise, so CI on a machine without fish stays green while the check still runs where possible.

## Risks / Trade-offs

- [A slug TAB with no stored list waits for the synchronous listing] → Only the very first slug completion in a directory that was never completed before pays it; the listing reads files only (no database, no git) and the compiled executable starts fast.
- [A variant created or removed within the last 30 seconds is not reflected on the next slug TAB] → The stale list is offered while a refresh runs, so the TAB after that is correct; the window is fixed and short.
- [Background job output or job notices leak into the prompt] → Each shell uses its silent detach form with all streams redirected; smoke tests assert no output and no remaining job.
- [The cache directory is tampered with by another user] → It lives under the user's own cache directory with mode 0700 and the listing only emits valid slugs, so even a tampered file cannot add words with spaces or shell metacharacters to the command line.
- [Slugs that exist only as database schemas are not offered] → Accepted and documented; they have neither state nor worktree, so none of the slug-taking commands can resolve them to a worktree anyway.
- [Listing logic diverges from how `list` finds variants] → Both read the same state files and `<prefix>*` directories; a test asserts the listing equals the file-based slugs of `list` for a fixture project.
- [Script goes stale after an upgrade] → Documented: regenerate on upgrade; the `eval`/`source` forms regenerate on every shell start.
- [Quoting bugs for descriptions with `'`, `:`, or `$`] → Descriptions are escaped per shell in one helper each; a test feeds a description containing those characters through every generator.
- [Shell not installed in CI, so load tests skip] → The string-level coverage tests always run; the smoke tests run wherever the shell exists, including the contributor's machine.
- [`CLI_ONLY_FLAGS` move touches `cli.ts` behavior] → Pure move; existing `cli.test.ts` covers `list --table` and stays green.

## Migration Plan

Additive. No migration, no config change. Rollback is removing the command; nothing persists on the user's machine unless they chose to save the script.
