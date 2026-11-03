## 1. Environment and interpolation (variant-config)

- [x] 1.1 Add the injectable lazy `environment` option to `loadConfig` (default the process environment) and move autodetection (`detectConnection`, `detectOnboarding`, renderer) onto it, with tests that the provider is called at most once, only on first use, and never by a `loadConfig` that nothing reads from
- [x] 1.2 Make `db` of the resolved configuration a lazy property; verify the existing autodetect, config and example tests still pass
- [x] 1.3 Switch the template engine to `${...}` (`${slug}`, `${abbr}`, `${schema}`, `${storage}`, `${worktree}`, `${url}`, `${port}`, `${<key>.port}`, `${NAME}`, `${NAME:-default}`, `$${` escape, nested default) and apply it at every use site named by the spec (db, commands, env, url, dir, preRm, seed, steps), with regex settings exempt; failing-first tests per site and per scenario of "Interpolation in every setting"
- [x] 1.4 Read `{{...}}` as `${...}` with a migration notice for `variants.yaml` and `variants.local.yaml` and extend the text-rewrite function of `schema-config-etc` (nested defaults, layout and comments kept), with tests for each scenario of "Legacy template syntax"
- [x] 1.5 Detect MariaDB (`mariadb://`, `MARIADB_*`, `MYSQL_*` wins, dialect `mysql`) with tests for URL, variables, precedence and the Postgres-first order
- [x] 1.7 Return the variable name per detected `db` field from `detectConnection`, with tests for each field
- [x] 1.8 Add `detectScriptWatches(dir)` (watch-like script rule, lockfile runner, project directory, skip list, not Vite/NestJS directories) and `detectOnboarding(dir)` (database label incl. `mariadb`, SQLite fallback not counting, application kinds in order, mise failure = nothing detected) with tests for every script-watch and notification-detection scenario

## 1b. Mise (tools/mise)

- [x] 1b.1 Add `resolveMiseBinary` to `variant-config` (editor path, `variant.mise.binPath` key of `variants.yaml` resolved against the file, `PATH`, usual locations incl. Homebrew and `~/.local/bin`, bad configured path = error naming the setting or key, nothing found = undefined) and the `variant.mise.binPath` schema key (non-empty string; JSON schema file and its test updated), with tests using a temp directory tree for every scenario of "Mise executable resolution"
- [x] 1b.2 Add the `variant-api` Mise module: runner using the resolved executable, the environment provider (`env --dotenv --quiet`, dotenv parser, merge over `process.env`, memoized), `MiseError` (directory, message, `untrusted`), variable sources (`set --raw --quiet`, `~` expanded), and the loader that wires the provider into `loadConfig`; tests with a fake Mise on a temp `PATH` for one-run-for-many-values, laziness, precedence, any official file, Mise missing, failure, untrusted, and sources
- [x] 1b.3 Switch the CLI, MCP server and extension to the `variant-api` loader and verify with their existing tests that behavior is unchanged without Mise references
- [x] 1b.4 Add the augment step to `variant-api` (`config ls --json`, keep entries inside the checkout, drop `.local.` names, first; create `mise.toml` when none; add to `[tools]`, append `[tools]`, already listed, invalid file unchanged with a reason, Mise not found reported with the places searched) with tests using fake `mise` output for every scenario of "Augmenting the Mise configuration"

## 2. Rendering (variant-config)

- [x] 2.1 Add `renderInitConfig(dir, { prefix })` using the `yaml` Document API, with tests for the written keys, same-line alternatives in the style of `variants.example.yaml` (other values only), omitted absolute paths, nothing-detected output, watch keys and omitted `dir`, `url` for Vite
- [x] 2.2 Write secrets as `${NAME}` references with `# from <relative path of the mise set source>` or `# from the environment` comments, with tests that no password or credentialed URL value appears in the output
- [x] 2.3 Render script watches without `kind` (key `app` and `dir: .` for the project directory) and add a round-trip test: the rendered file passes `VariantsConfigSchema`, `loadConfig` of it resolves the autodetected database (secrets resolved from the same environment), and the example project renders to a loadable file

## 3. Init operation (variant-api)

- [x] 3.1 Implement `operations/init.ts` and `client.init` (file write, existing-file refusal via the `loadConfig` lookup, `force`, prefix validation, per-step result shape) with tests in `packages/variant-api/test/` for every scenario of the init command, existing configuration and file steps
- [x] 3.2 Implement the `.gitignore` step (create, append with newline repair, idempotent, independent of the file step) with tests for created, appended, already present and skipped
- [x] 3.3 Call the augment step of 1b.4 from `init` as the `mise` step, reported in the result without stopping the other steps, with tests for the step result, a failing step, and `--mise=false`
- [x] 3.4 Register `init` in `commands.ts` with args `prefix`, `file`, `gitignore`, `mise`, `force` and verify the generated CLI flags, MCP tool `variant_init` and completion scripts include them (existing completion and MCP tests extended)

## 4. CLI and MCP surface

- [x] 4.1 Render `variant init` in `packages/variant-cli/src/output.ts` as text, JSON and YAML, and verify with CLI tests that `--gitignore=false` skips a step and that failure on an existing file exits 1 naming it
- [x] 4.2 Verify `variant_init` in `packages/variant-mcp/test/mcp.test.ts` writes into a temp directory and does not touch the extension socket

## 5. VS Code onboarding

- [x] 5.1 Add the commit watcher (reflog path via `git rev-parse --git-path logs/HEAD`, last-entry classification, startup entry ignored) behind an injectable interface, with tests for local commit, amend, initial commit, pull, merge, rebase, checkout, clone and a linked worktree
- [x] 5.2 Add the notification flow and `workspaceState` record (gates in order, text `Detected postgres+vite, ...`, `Bootstrap Variant` button, once across restarts) with tests against `mocks/vscode.ts` extended as needed
- [x] 5.3 Add the webview view `variant.onboarding` and the `variant.onboardingOpen` swap with `variant.variants` in `package.json`, and verify with a manifest test that exactly one of the two views is shown per context value
- [x] 5.4 Implement the dialog HTML (CSP nonce, icon top right, prefix input and live label, three prechecked checkboxes (`Augment mise.toml with variant-cli`), `Cancel`/`Init`, disabled state with reason, existing-config state, narrow single column) and its message handling, with tests for HTML content and each message path including a failing step staying open
- [x] 5.5 Register `variant.onboardingInit` (sets the context, runs `variant.onboarding.focus`, restores the tree and refreshes the store on `Cancel`/`Init`, opens the written file, clears the context on dispose) in `extension.ts` and `package.json`, with tests for focus, run-again, init and cancel
- [x] 5.6 Add the `variant.mise.binPath` setting (manifest with a description that names Mise, passed to every in-process call, applied without a reload) and the Mise failure wrapper (one notification per directory and kind per session, `Trust` runs `mise -C <dir> trust --all` then repeats the action, trust failure shown, dialog `Init` retry), with tests for each editor scenario of `tools/mise` (setting and Trust) against `mocks/vscode.ts` and a fake Mise

## 6. Documentation and verification

- [x] 6.1 Document `variant init` in the README CLI section, `docs/guide/core.md` and `docs/mcp.md`, `${...}` interpolation (replacing `{{...}}`, with the `$${` escape and the migration), lazy Mise environment, `resolveMiseBinary` and `variant.mise.binPath`, Trust on failures, and MariaDB in `docs/guide/configuration.md`, and every README, docs, `variants.example.yaml`, example-project and extension README snippet that shows `{{...}}`, the editor command and notification in the extension README and `docs/`, and add a `CHANGELOG.md` Unreleased entry; `scripts/docs-coverage.spec.ts` passes
- [x] 6.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and `task check:full`, and fix findings
- [x] 6.3 At sync-archive, replace `{{...}}` by `${...}` in the text of `openspec/specs/` and verify with `openspec validate --all --strict --no-interactive`
