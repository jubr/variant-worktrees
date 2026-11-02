## 1. Command and error handling (outside-in)

- [x] 1.1 Add `packages/variant-cli/test/completions.test.ts` driving the CLI entry for `completions zsh|bash|fish`, `completions` (missing), `completions powershell`, and `--help`; verify it fails (red)
- [x] 1.2 Move `CLI_ONLY_FLAGS` out of `cli.ts` into a shared module and verify the existing `cli.test.ts` (`list --table`) still passes
- [x] 1.3 Register the `completions` cleye command in `cli.ts` with a positional `<shell>`, extend the unknown-command check to accept it, and validate the shell before any other work without calling `createClient`; verify the error and help scenarios pass and that it runs in a directory without git or `variants.yaml`

## 2. Script generation

- [x] 2.1 Add coverage tests: for each shell, every `commands[]` name and flag (with short alias), `completions`, `--help`, `--version`, and the shell names appear; `--table` is absent from `create` and `--detach` from `list`; verify they fail (red)
- [x] 2.2 Implement `describeCli()` in `src/completions.ts` from `commands[]`, the CLI-only flags, and `completions`; verify a unit test over its output for `create`, `watch`, `implode`, and `list`
- [x] 2.3 Implement the bash generator and verify its coverage tests pass
- [x] 2.4 Implement the fish generator with per-subcommand scoping and descriptions, and verify its coverage tests pass
- [x] 2.5 Implement the zsh generator with the dual-mode `compdef` guard and descriptions, and verify its coverage tests pass
- [x] 2.6 Add a test that a description containing `'`, `:`, `$`, and a backtick is escaped in every generator, and verify it passes
- [x] 2.7 Add load smoke tests that source each script in its real shell (skipped when the shell is missing) and verify no error output and a registered completion; run them locally for every shell that is installed

## 3. Slug completion

- [x] 3.1 Add tests for `completions --list-slugs` over a temporary project: states plus `_v-*` directories combined, deduplicated, sorted; custom `variant.prefix`; no variants; unloadable configuration (empty stdout and stderr, exit 0); verify they fail (red)
- [x] 3.2 Extract the state directory rule of `createClient` into one shared helper and verify existing client tests still pass
- [x] 3.3 Implement `--list-slugs` on the `completions` command (optional `<shell>` only with it, no `createClient`, errors swallowed) and verify the tests from 3.1 pass
- [x] 3.4 Add a test that `--list-slugs` creates no state directory and opens no database connection, and verify it passes
- [x] 3.5 Add a test that the listing equals the file-based slugs `list` reports for a fixture project, and verify it passes
- [x] 3.6 Add `takesSlug` to `describeCli()` and tests that each generated script wires `--list-slugs` into `--slug`/`-s` values and the positional of slug-taking subcommands only; verify they fail (red)
- [x] 3.7 Wire slug completion into the bash, fish, and zsh generators (synchronous listing first) and verify the tests from 3.6 pass
- [x] 3.8 Add a test that `--list-slugs` skips directories whose names are not valid slugs (`_v-bad name`, `_v-Upper`), and verify it passes
- [x] 3.9 Add generator tests for the slug memory: each script uses the three `__variant_*` variables (slugs, directory, time), checks directory and 30 second age, and contains no file or directory creation (no `mkdir`, `mktemp`, `>` to a path, `touch`, `set -U`); verify they fail (red)
- [x] 3.10 Implement the in-shell memory with synchronous gathering for all three generators (fish and old bash use it as-is) and verify the tests from 3.9 pass
- [x] 3.11 Add generator tests for prefetch: zsh uses `exec {fd}< <(...)` with `zle -F` and a handler that closes the descriptor; bash 4.1+ uses `exec {fd}< <(...)`, `read -t 0 -u`, and `mapfile -u`, guarded by `BASH_VERSINFO`; fish and bash older than 4.1 contain no background start; verify they fail (red)
- [x] 3.12 Implement prefetch for zsh and bash 4.1+ with stale-while-revalidate and waiting on a gathering in flight, and verify the tests from 3.11 pass
- [x] 3.13 Extend the shell load smoke tests (2.7): where `bash` (4.1+), `zsh`, or `fish` is installed, drive completion against a fixture project with a `variant` stub on `PATH` that records its calls, and verify: the first `variant ` completion in zsh and bash starts exactly one background gathering and prints nothing; after it finishes, `variant up -s ` is answered without a further call; a list older than 30 seconds is offered and gathered again (zsh, bash); the first `-s` completion with nothing remembered is answered; a second `-s` completion within 30 seconds in fish starts no second call; a different directory is not served the list of the first; no job notice appears and no file is created under `$HOME` or the temp directory; run locally for every installed shell, and run the bash 3.2 fallback with `/bin/bash` on macOS

## 4. Docs

- [x] 4.1 Add install instructions for zsh, bash, and fish, and the regenerate-after-upgrade note and that slugs are completed live from local state, to the CLI section of `README.md` and to `docs/guide/core.md`; verify `task docs:build` passes
- [x] 4.2 Add an `Added` entry for `variant completions` under an `Unreleased` heading in `CHANGELOG.md`; verify the entry sits under that heading

## 5. Verification

- [x] 5.1 Run `task check:full` and `openspec validate --all --strict --no-interactive` and verify both pass
