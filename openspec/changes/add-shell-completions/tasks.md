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

## 3. Docs

- [ ] 3.1 Add install instructions for zsh, bash, and fish, and the regenerate-after-upgrade note, to the CLI section of `README.md` and to `docs/guide/core.md`; verify `task docs:build` passes
- [ ] 3.2 Add an `Added` entry for `variant completions` under an `Unreleased` heading in `CHANGELOG.md`; verify the entry sits under that heading

## 4. Verification

- [ ] 4.1 Run `task check:full` and `openspec validate --all --strict --no-interactive` and verify both pass
