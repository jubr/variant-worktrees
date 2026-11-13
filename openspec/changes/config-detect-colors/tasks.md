## 1. Origin of each resolved value

- [ ] 1.1 Add failing tests for [specs/variant-config/core | Config CLI command](../../specs/variant-config/core/spec.md#requirement-config-cli-command) beside config loading: a literal in the main file is `variants.yaml`; a literal in the worktree's own file is `worktree` and the main file's value is not used; an omitted `variant.prefix` is `default`; an omitted `variant.main` is `autodetect`; a Vite watch discovered with `variant.watches` absent is `autodetect`; `db.host` from `POSTGRES_HOST` is `env POSTGRES_HOST`; `db.host: ${POSTGRES_HOST}` with the variable set is `env POSTGRES_HOST`; `db.host: ${DB_HOST:-127.0.0.1}` with `DB_HOST` unset is the loaded file; a database field with no variable on a detected connection is `autodetect`; the sqlite fallback is `default`; `env` with no name when the environment supplied the value and no variable was recorded. The map is not an enumerable key of the resolved object. Verify the new tests fail.
- [ ] 1.2 Record that map while resolving, non-enumerable, using the classification in [design.md](design.md). Verify the tests from 1.1 pass.

## 2. Comments on the config text

- [ ] 2.1 Add failing tests in the CLI text specs for the same requirement: `variant config` text includes a detected default and an environment value with their comments; a `variant:` line has no origin comment; a worktree prefix is commented `worktree` and the main prefix is absent; stripping comments yields the `--json` value; `--json` and `--yaml` have no origin comment; a password is `***` in all three and the text line still ends with the origin comment; an invalid file still exits 1 with the validation error on stderr. Verify the new tests fail.
- [ ] 2.2 Print `config` with the typed walker and the origin map. Leave every other command on `outline()`. Verify the tests from 2.1 pass.

## 3. yq colors on a terminal

- [ ] 3.1 Add failing renderer tests for the same requirement: with color on, a key is `ESC[36m`, a string `ESC[32m`, a number and a boolean `ESC[95m`, a comment `ESC[90m`, and `null`, `[]`, `{}`, colons, and dashes are uncolored; `ESC[0m` closes each span; without color the characters match and contain no `ESC`. Add failing tests that color is on only when stdout is a terminal and `NO_COLOR` is unset, including when `NO_COLOR` is empty. Verify the new tests fail.
- [ ] 3.2 Color inside the walker from the value's type. The CLI passes stdout's terminal bit and `NO_COLOR` the way a log line does. Verify the tests from 3.1 pass, and a piped `variant config` from the CLI harness has comments and no `ESC`.

## 4. Docs and gates

- [ ] 4.1 Update the `config` section of `docs/guide/core.md` (origin comments, terminal colors, plain `--json` and `--yaml`) and add an Unreleased entry to `CHANGELOG.md`. Verify `task docs:build` passes.
- [ ] 4.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive`, and `task check:full`. Verify each passes.
