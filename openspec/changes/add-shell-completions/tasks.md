## 1. Command and error handling (outside-in)

- [ ] 1.1 Add `packages/variant-api/test/completions.test.ts` driving the CLI entry for `completions zsh|bash|fish`, `completions` (missing), `completions powershell`, and `--help`; verify it fails (red)
- [ ] 1.2 Move `CLI_ONLY_FLAGS` out of `cli.ts` into a shared module and verify the existing `cli.test.ts` (`list --table`) still passes
- [ ] 1.3 Register the `completions` cleye command in `cli.ts` with a positional `<shell>`, extend the unknown-command check to accept it, and validate the shell before any other work without calling `createClient`; verify the error and help scenarios pass and that it runs in a directory without git or `variants.yaml`

## 2. Script generation

- [ ] 2.1 Add coverage tests: for each shell, every `commands[]` name and flag (with short alias), `completions`, `--help`, `--version`, and the shell names appear; `--table` is absent from `create` and `--detach` from `list`; verify they fail (red)
- [ ] 2.2 Implement `describeCli()` in `src/completions.ts` from `commands[]`, the CLI-only flags, and `completions`; verify a unit test over its output for `create`, `watch`, `implode`, and `list`
- [ ] 2.3 Implement the bash generator and verify its coverage tests pass
- [ ] 2.4 Implement the fish generator with per-subcommand scoping and descriptions, and verify its coverage tests pass
- [ ] 2.5 Implement the zsh generator with the dual-mode `compdef` guard and descriptions, and verify its coverage tests pass
- [ ] 2.6 Add a test that a description containing `'`, `:`, `$`, and a backtick is escaped in every generator, and verify it passes
- [ ] 2.7 Add load smoke tests that source each script in its real shell (skipped when the shell is missing) and verify no error output and a registered completion; run them locally for every shell that is installed

## 3. Slug completion

- [ ] 3.1 Add tests for `completions --list-slugs` over a temporary project: states plus `_v-*` directories combined, deduplicated, sorted; custom `variant.prefix`; no variants; unloadable configuration (empty stdout and stderr, exit 0); verify they fail (red)
- [ ] 3.2 Extract the state directory rule of `createClient` into one shared helper and verify existing client tests still pass
- [ ] 3.3 Implement `--list-slugs` on the `completions` command (optional `<shell>` only with it, no `createClient`, errors swallowed) and verify the tests from 3.1 pass
- [ ] 3.4 Add a test that `--list-slugs` creates no state directory and opens no database connection, and verify it passes
- [ ] 3.5 Add a test that the listing equals the file-based slugs `list` reports for a fixture project, and verify it passes
- [ ] 3.6 Add `takesSlug` to `describeCli()` and tests that each generated script wires `--list-slugs` into `--slug`/`-s` values and the positional of slug-taking subcommands only; verify they fail (red)
- [ ] 3.7 Wire slug completion into the bash, fish, and zsh generators and verify the tests from 3.6 pass
- [ ] 3.8 Extend the shell load smoke tests (2.7): where `bash` or `fish` is installed, drive a completion request for `variant up --slug ` against a fixture project with a `variant` stub on `PATH`, and verify the fixture slugs are offered; run locally for every installed shell

## 4. Docs

- [ ] 4.1 Add install instructions for zsh, bash, and fish, and the regenerate-after-upgrade note and that slugs are completed live from local state, to the CLI section of `README.md` and to `docs/guide/core.md`; verify `task docs:build` passes
- [ ] 4.2 Add an `Added` entry for `variant completions` under an `Unreleased` heading in `CHANGELOG.md`; verify the entry sits under that heading

## 5. Verification

- [ ] 5.1 Run `task check:full` and `openspec validate --all --strict --no-interactive` and verify both pass
