## Why

A project only benefits from Variant once it has a `variants.yaml`, and writing one by hand means reading the
schema first. Everything the file needs (database, watches, watch commands, abbreviation) is already autodetected
at runtime, but never made visible or editable. People who would use Variant never start because the first step is a
blank file.

## What Changes

- Add `variant init`: writes a `variants.yaml` that holds every autodetected value, with the other accepted values of
  a setting in a comment on the same line. Three independent steps: write `variants.yaml`, add `<prefix>*` to
  `.gitignore`, augment the mise configuration with the CLI (any file mise supports). Available in the CLI and as an MCP tool, and runs in `variant-api`.
- Secrets are never written. Init writes a reference for a password or credentialed URL, `${POSTGRES_PASSWORD}`,
  with a comment such as `# from ../mise.local.toml`.
- Interpolation works in every string setting, `db` included, with one syntax: `${NAME}`, `${NAME:-default}` and the
  variant placeholders `${slug}`, `${port}`, `${<key>.port}` and the rest. **BREAKING:** `${...}` replaces `{{...}}`
  (a literal `${` for a shell is `$${`). Files with `{{...}}` keep loading and are migrated with the mechanism of
  `schema-config-etc`.
- Environment values are read lazily and through mise only: one `mise -C <dir> env --dotenv --quiet` per loaded
  configuration, run when a value is first needed (not for `variant list`), merged over the process environment.
  Mise files are no longer parsed for values. The files that define variables come from `mise -C <dir> set --raw
  --quiet`.
- Detect MariaDB (`mariadb://`, `MARIADB_*`) as the `mysql` dialect, next to Postgres, MySQL and SQLite.
- A package with a watch-like script becomes a script watch in the written file, for example
  `variant.watches.api.watch: npm run watch` (the first watch-like script, run through the package manager of its
  lockfile). `kind` becomes optional for such a watch.
- Locate Mise with `resolveMiseBinary` in `variant-config`: the editor setting `variant.mise.binPath` first, then the
  `variant.mise.binPath` key of `variants.yaml`, then `PATH`, then usual install locations such as Homebrew. All other
  Mise functionality (environment, variable sources, configuration listing, augmenting, trust) lives in `variant-api`
  so the CLI and MCP server share it. In the editor a Mise failure (for example an untrusted configuration) becomes an
  error notification with a `Trust` button that runs `mise trust` and retries.
- Add the VS Code command `variant.onboardingInit`. It shows the initialization dialog in the Variant Worktrees
  section of the Explorer (revealed, expanded and focused, replacing the tree while open): intro text, the extension
  icon at the top right, a `Prefix` input (default `_v-`), three prechecked checkboxes (write `variants.yaml`, add
  `_v-*` to `.gitignore`, augment `mise.toml` with variant-cli) and the buttons `Cancel` and `Init`.
- Offer that dialog once per workspace through a notification: when a workspace has no `variants.yaml`, a commit was
  just made locally, and a database (`postgres`, `mysql`/`mariadb` or `sqlite`) and an application (`vite`, `nestjs`
  or a package with a watch-like script) are detected, the extension shows
  `Detected postgres+vite, want to bootstrap Variant in this repo?` with a button that opens the dialog.

Ordering: this branch is rebased on `schema-config-etc` (`variant.watches`, default `dir`, legacy migration notices
and rewrite) and merges after it.

## Capabilities

### New Capabilities

- `variant-api/init`: the `variant init` command, the content of the written `variants.yaml`, secrets as environment
  references, script watches, the `.gitignore` and mise steps, and what happens when a file already exists.
- `variant-vscode/onboarding`: the `variant.onboardingInit` command, the dialog in the Explorer section, and the
  one-time notification triggered by a local commit.
- `tools/mise`: executable resolution (`variant.mise.binPath` in the editor and in `variants.yaml`), the lazy
  environment read through Mise, variable sources, augmenting the Mise configuration with the CLI, and Mise failures
  with `Trust` in the editor. The other capabilities refer to it.

### Modified Capabilities

- `variant-config/core`: interpolation in every setting with `${...}`; legacy `{{...}}` migration; MariaDB detection
  (added requirements).
- `variant-config/cfg-settings`: the key `variant.mise.binPath` (added requirement, pointing at `tools/mise`).
- `variant-config/cfg-instances`: a watch may omit `kind` (added requirement).

## Impact

- `variant-config`: MariaDB keys, `resolveMiseBinary`, a lazy environment provider that callers inject (replacing direct mise file parsing), the `${...}` template
  engine at every use site (replacing `{{...}}`) and its legacy migration, optional `kind`, variable sources, an
  onboarding detection summary, the init renderer.
- `variant-api`: the Mise module (environment, sources, `config ls`, augment, trust, Mise errors), `init` operation
  (file, `.gitignore`, Mise configuration) and client method, command definition shared by CLI and MCP.
- `variant-cli`: `variant init` and its completions; `variant-mcp`: `variant_init` tool.
- `variant-vscode`: the `variant.mise.binPath` setting, Mise failure notifications with `Trust`, command, webview view, tree/webview swap contexts, commit watcher, notification state, manifest.
- README, `docs/guide/core.md`, `docs/guide/configuration.md`, `variants.example.yaml`, the example project and every snippet that shows `{{...}}`, `docs/mcp.md`, `CHANGELOG.md`.

Non-goals: an interactive CLI wizard; autodetecting script watches at runtime (only `init` writes them); a way to
resize an Explorer section (the editor offers none); editing a `variants.yaml` that already exists beyond an
explicit overwrite.
