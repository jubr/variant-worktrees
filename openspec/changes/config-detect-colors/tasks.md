## 1. Origin of each resolved value

- [ ] 1.1 Add failing tests for [specs/variant-config/core | Config CLI command](../../specs/variant-config/core/spec.md#requirement-config-cli-command) beside config loading. With cwd at the file's directory, a literal is `# from ./variants.yaml`. With cwd in a worktree whose file is the parent `variants.yaml`, a literal is `# from ../variants.yaml`. A worktree file's literal is `# from ./variants.yaml` and the main file's value is not used. An omitted `variant.prefix` is `# default`. An omitted `variant.main` is `# autodetect main` and `variant.root` is `# autodetect root`. A Vite watch discovered with `variant.watches` absent is `# autodetect watch`. `db.host` from `POSTGRES_HOST`, and `db.host: ${POSTGRES_HOST}` with the variable set, are `# from env POSTGRES_HOST`. `db.host: ${DB_HOST:-127.0.0.1}` with `DB_HOST` unset is `# from ./variants.yaml`. A database field with no variable on a detected connection is `# autodetect connection`. The sqlite fallback is `# default`. The map is not an enumerable key of the resolved object. Verify the new tests fail.
- [ ] 1.2 Record that map while resolving, non-enumerable, using the classification in [design.md](design.md). Paths are relative to the cwd given to load. Verify the tests from 1.1 pass.

## 2. Comments on the config text

- [ ] 2.1 Add failing tests in the CLI text specs for the same requirement: a detected default carries `# default` on its line or the ancestor that covers it; `host` from `POSTGRES_HOST` is commented `# from env POSTGRES_HOST`; `chatRenamer` with only file values is `# from ./variants.yaml` on the parent and the children have no comment; `variant.prefix` literal plus `variant.seed: ${VARIANT_SEED}` puts `# from ./variants.yaml` on `variant`, no comment on `prefix`, and `# from env VARIANT_SEED` on `seed`; a worktree prefix is `_wt-` under `# from ./variants.yaml` and the main prefix is absent; stripping comments yields the `--json` value; `--json` and `--yaml` have no origin comment; a password is `***` in all three and the text still names `# from ./variants.yaml` or `# from env POSTGRES_PASSWORD`; an invalid file still exits 1 with the validation error on stderr. Verify the new tests fail.
- [ ] 2.2 Print `config` with the typed walker and the origin map. Comment a key, and skip descendants that share its origin. Leave every other command on `outline()`. Verify the tests from 2.1 pass.

## 3. yq colors on a terminal

- [ ] 3.1 Add failing renderer tests for the same requirement: with color on, a key is `ESC[36m`, a string `ESC[32m`, a number and a boolean `ESC[95m`, a comment `ESC[90m`, and `null`, `[]`, `{}`, colons, and dashes are uncolored; `ESC[0m` closes each span; without color the characters match and contain no `ESC`. Add failing tests that color is on only when stdout is a terminal and `NO_COLOR` is unset, including when `NO_COLOR` is empty. Verify the new tests fail.
- [ ] 3.2 Color inside the walker from the value's type. The CLI passes stdout's terminal bit and `NO_COLOR` the way a log line does. Verify the tests from 3.1 pass, and a piped `variant config` from the CLI harness has comments and no `ESC`.

## 4. Docs and gates

- [ ] 4.1 Update the `config` section of `docs/guide/core.md` (the four comment forms, parent collapse, relative paths, terminal colors, plain `--json` and `--yaml`) and add an Unreleased entry to `CHANGELOG.md`. Verify `task docs:build` passes.
- [ ] 4.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive`, and `task check:full`. Verify each passes.
