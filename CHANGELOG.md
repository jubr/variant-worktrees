# Changelog

## Unreleased

### Added

- `task release:prepare` prepares a patch release from `main`: version bump, GitHub-generated release notes in every
  `CHANGELOG*.md`, a `chore(release): v<version>` commit on `release/v<version>`, and a pull request into `main`. The
  parts are `release:check`, `release:changelog` and `release:pr`. It does not tag; the release workflow does at merge.
- The README and the configuration guide describe how each `VARIANT_*` environment variable maps to a
  `variants.yaml` setting or template placeholder, and in which direction it works.
- The Variant Worktrees view sorts by name, created or changed (`variant.sort`, default name ascending). Created is the
  earlier birth time of the variant directory and `variants.local.yaml`; changed is the later modification time. The
  panel follows that setting; the browser page stays in name order. Records carry `createdMs`, `changedMs` and
  `implodeClean` (whether implode without `--force` would succeed, including `preRm`, untracked and restore).
- The play action is named **variant watch**; the icon stays play. The trash icon sits at the right of every row except
  `main`: theme foreground when implode would succeed, red when it would fail.
- A **Variant Worktrees** section in the Explorer: every variant with a watching, up or down icon, the uptime, and inline play,
  stop and implode (after a confirmation). The context menu shows a variant's output, opens its URL, opens the panel
  and the web page. It follows changes made by the CLI, an agent or another window within seconds.
- **Variant: Open Variants Panel** shows the same list in an editor panel; **Variant: Open Variants in Browser** opens
  the web page of a running UI server.
- `variant ui` starts a local web server with the same app: it binds to loopback, requires a token, checks the `Host`
  header and asks for a confirmation to implode. It records itself as the reserved `variant-ui` instance of `main`,
  so `variant list` and the view show it.
- `variant.ui.port` and `VARIANT_UI_PORT` set the port of `variant ui`. The instance key `ui` is reserved because its
  environment segment would share that variable. The server ships inside the `variant-cli` package and the compiled
  `variant` executables, together with the app.
- `variant.abbr`, a short project label (`variant-worktrees` is `vw`) for hostnames, and the `{{abbr}}` placeholder of
  `open` URL templates.
- `variant-api` `client.subscribe`: the current records now and again whenever runtime state, state files or process
  liveness change.
- `variant status [slug]` (and the `variant_status` MCP tool): everything known about one variant, including all
  meta information of its runtime state (mode, directory, database settings with the password hidden, and per
  instance the port, pid, URL, liveness and uptime).
- Global `--json` and `--yaml` flags on every command, listed in a `Global flags` help section and README
  subsection apart from the flags of each command.
- `-v` as the short form of `--verbose`. On `list` (and `variant_list`) it shows all meta information of every
  variant, the same as `status`.
- Variants report `uptimeSeconds` (how long their live recorded processes have run) and `log`.
- A detached `watch` writes the output of all its processes to `variants.watch.log` in the worktree and records
  the path as `runtime.log`, so it can be followed with `tail -f`.
- CONTRIBUTING requires new commands and functionality to be added to the README and the documentation.
- `variant.main`: the main checkout the worktrees are made from (default: the target of a parent `AGENTS.md`
  symlink, else the git checkout).
- A worktree created inside the main tree adds `_v-*` (the configured prefix) to an existing `.gitignore`.

- `variant-api` runs on Node.js 22.13 or newer as well as on Bun: a SQLite variant uses `node:sqlite` under Node
  and `bun:sqlite` under Bun, loaded only when a SQLite variant is used, and the `implode` cleanup patterns are
  matched by a runtime-neutral glob.
- `variant-cli` package that provides the `variant` command and shares the lockstep release version.

### Changed

- The extension description and README tagline are `Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`.
  The extension README no longer embeds the icon by a relative path, which rendered broken on the extension pages.
- **BREAKING** `variants.yaml` options are renamed or merged. Migrate with this table:
  - `open` (instance) becomes `url`.
  - `dotenv`, `dotenvSource`, `env` and `envAlways` become `env: { sourceFile, overrides }`. The overrides and the
    storage variable are written into the env file copy once, when it is created. Use `VARIANT_ENV_SOURCE` to pick
    another source.
  - `{{port.<key>}}` becomes `{{<key>.port}}`.
  - `storage.env` becomes `storage.envVarName`.
  - Step `show` becomes `filterLinesRegex`, and step `unlessEnv` is replaced by `VARIANT_STEP_<NAME>=no`.
  - `implode.untracked` is merged into `implode.preRm`, which now holds globs for files and directories matched from
    the project directory and each instance directory. `implode.restore` becomes `implode.discard`.
  - `variant.up` and `variant.watch` are removed: set `up` and `watch` on an instance.
  - `container` is `{ dockerfile, internalPort? }`. `image`, `build`, `static`, `proxy`, `volumes`, `env` and `port`
    are removed together with the generated nginx configuration; the image is `v-<key>:v-<slug>`, and a container
    receives the `VARIANT_*` and database variables only, without `SQLITE_DATABASE` and the storage variable. Put a
    web server and its proxy in the Dockerfile, as `example/fe/Dockerfile` does.
- **BREAKING** `variant` moves from `variant-api` to the new `variant-cli` package: `npm install -g variant-cli`
  provides it, `variant-api` is the library only and no longer depends on the command-line parser. Commands, flags
  and output are unchanged, and the release executables keep their names. `variant --version` reports the version
  of `variant-cli`.
- **BREAKING** `variant.root` is only the directory that holds the worktrees. With a parent `AGENTS.md` symlink into
  the main checkout it now defaults to the directory that holds the symlink, so `variant watch foo` creates
  `<parent>/_v-foo` instead of `<main>/_v-foo`. Without the symlink it stays the main checkout. The resolved
  `variant.root` of `loadConfig` follows; use the new `variant.main` for the main checkout. Set `variant.root` to
  the main checkout to keep the old place; existing worktrees are still found by slug.
- **BREAKING** The default `open` URL of an autodetected Vite instance is `http://{{slug}}.{{abbr}}.localhost:{{port}}`
  instead of `http://{{slug}}.vw.localhost:{{port}}`; a project whose directory name does not abbreviate to `vw` gets
  another host. Set `open` on the instance to keep the old one.
- **BREAKING** The VS Code extension needs VS Code 1.101 or a host with Node.js 22.13 or newer, because its views read
  sqlite databases through `node:sqlite`. Older hosts do not activate it.
- The extension socket still refuses `config`, `create`, `list`, `provision`, `up`, `down`, `watch` and `implode`; the
  extension's own views run `list`, `watch`, `down` and `implode` in-process.
- **BREAKING** The CLI prints a text summary instead of JSON by default. Add `--json` to get the previous output.
- **BREAKING** `variant list` prints the table `slug, mode, uptime, url, log, dir` by default; the `schema`
  column moved to `list -v`/`--json`.

### Fixed

- A detached `watch` that cannot start a process no longer leaves an empty `variants.watch.log` behind.

### Removed

- **BREAKING** `variant list --table`; the table is the default.

## 0.0.4

### Fixed

- `variant --version` and `--help` report the package version instead of a fixed `v0.0.1`.

### Removed

- **BREAKING** The `switch` command: the `variant switch` CLI command, the `variant_switch` MCP tool,
  `client.switch()` and the `switchWorktree` export. It only changed the working directory of the process
  that ran it. `create` still ensures the `_v-*` worktree and returns its path.

## 0.0.1

### Added

- Shared `variant-config` package for YAML and mise/environment discovery.
- `variant-api` lifecycle client and `variant` CLI.
- `variant-mcp` tools for database variant operations.
