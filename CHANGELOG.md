# Changelog

## Unreleased

### Added

- Chat Renamer holds the Mac awake with one `caffeinate` process while a chat is taking a turn or generating, including tool work of that turn. `awake.when` is `chatsActive` (default) or `never`. `awake.what` `screen` (default) runs `caffeinate -disu`; `cpu` runs `caffeinate -dis`. `awake.graceDelaySecs` (default `60`, `0` stops at once) keeps that process after the last turn. An open, selected, or idle chat does not count. The enable setting does not turn this off.
- `variant-log` is the shared log event: a level, a message, and an optional slug and step. The library, the editor socket, and MCP emit on it. The CLI is the only place that colors a line.
- The Variant Worktrees extension registers the `variant` MCP server for the open workspace in Cursor and VS Code. The `mcp.json` snippet stays the setup for other clients.
- `--mise-install` on `create`, `provision`, and `watch` (library and MCP `miseInstall`, values `bg`, `sync`, and `no`, no short flag). Omit it and the value is `bg`. The install runs only when the worktree has a Mise config, and only from `create`; `provision` and `watch` pass the flag through. `up` does not take it, and there is no configuration-file key. The run is `trust --all`, then `install`, in the worktree. `bg` returns immediately and writes `{worktree}/.cache/variant/mise-install.log`. `sync` waits and fails the command when Mise fails; the worktree stays. Slug `main` and a create that makes no worktree skip it.
- `--pull-ff` on `create`, `provision`, `up`, and `watch` (library `pullFf`, MCP `pullFf`, no short flag) fast-forwards the start branch before a new variant branch is created. It does not pull the new branch. The start branch is `from` when that names a local branch, otherwise `variant.baseBranch`. A tag, commit, remote-tracking name, or `HEAD` is used as given. A dry-run that predicts a conflict, divergence, a missing upstream, or another error leaves that checkout un-pulled. When the update fails after a clean dry-run, the checkout is restored and the error includes the command to run again. Omit the flag and nothing is fetched. An existing worktree, an existing prefixed branch, and slug `main` skip the network.
- A release created from `main` attaches `packslip.sigstore.json` for the six `variant` executables. The signing job has `contents: read`.

### Changed

- The library factory is `createVariantClient`.
- Startup expands the Explorer **Variant Worktrees** section without taking focus. The one-time onboarding notification focuses that section.
- `implode` removes the local branch after the worktree. `--branch-rm=yes|no` chooses that step. The default is `yes`. `--branch-rm=no` keeps the branch. A `[debug]` line names the branch.
- Onboarding initializes the main checkout when the opened workspace folder has no `.git` directory.
- Feature-branch CI no longer builds a macOS `variant` executable. Release still builds every platform executable.
- `variant --version` prints the version and a parenthetical, then, only when stdout is a terminal, a cursive `Variant-Worktrees` banner and a blank line, then the platform and the repository URL. A pipe omits the banner and the blank line. On `main` the parenthetical is the UTC date. Off `main` it is the UTC date and time, and the version gains `-{slug}-{n}-{hash4}`. On a terminal the banner is orange and its hyphens stay the default color. `task bleed:vsix` writes that version token into the unpacked extension `package.json`.
- A library log line starts with `[trace]`, `[debug]`, `[info]`, `[warn]`, or `[error]`. `warning` still selects `warn`. The step, when the event has one, follows the bracket. On a terminal, with `NO_COLOR` unset, the brackets are dark gray, the level word is colored, and the step is cyan. Configuration lines that print `warning:` are unchanged.
- The CLI sends each log event to the editor on the project Unix socket. Steps `ipc` and `cli` (`connected`, `connect failed`, `write failed`, `end`) stay on standard error and are not sent. Connect success and failure are one `[debug]` line each; failure names the reason. CLI end is one `[debug]` line. A write waits at most one second, then one `[warn] ipc write failed` line, and later events skip the socket. A bare event carries `-s` or `--slug` when that flag was given, and otherwise the autodetected slug, including `main`. A missing editor does not change the command result. `ipc` and `cli end` stay `debug` when the working directory is under `/tmp`.
- A shell command in the log is `+"<command>"`. Schema lines such as `create schema …` stay plain sentences. The Variant Worktrees channel ends a CLI line with ` @cli` and an MCP line with ` @mcp`.
- MCP sends each library log event to that socket with origin `mcp`. The logging notification stays unmarked and does not contain ` @mcp` or `cmd=`.
- A library event for a variant whose project directory is under `/tmp`, including through the `/tmp` symlink, is emitted at `trace`. `list` does not log that it listed. `implode` finish and branch lines carry the variant slug. Log levels are the `LogLevel` string enum.
- Starting and killing the awake `caffeinate` process are debug lines. A title-event decision whose reason is `rename request` is debug. The awake grace lines stay trace.
- The Variant Worktrees channel's next line after `activating variant-worktrees` is the long `variant --version` text, without color.
- Existing-chats runs at startup, when the setting changes, and from the command. A title event does not start it. Those lines are debug.
- `task package:vsix:unpacked` is removed. `task bleed:vsix`, `task bleed:cli`, and `task bleed:mcp` publish the extension, the host `variant` executable, and the host `variant-mcp` executable into `vw-bleeds` beside the checkout. `task bleed:all` runs the three.

## [0.0.7] - 2026-11-06

### Changed

- A detached `watch` writes its output to `.cache/variant/watch.log` in the worktree.

### Added

- `--log-level` (`trace`, `debug`, `info`, `warn`, `error`, or `warning`) prints the library log on standard error. The default is `warn`. `-v` stays richer command output.
- When PostgreSQL or MySQL cannot be contacted, reads still list variants known from state and worktrees and warn once. Changes fail with that sentence and do not show SQL. `create` does not add a worktree. The editor trees show `Database unreachable` first and one warning per outage. MCP sends the same stream as logging notifications.
- VS Code: an activity-bar **Variant Worktrees** tree lists the same rows as the Explorer section, with icon `vw-mini-icon.svg`.

### Release notes

- feat(variant-vscode): show the variants tree on the activity bar by @jubr in https://github.com/jubr/variant-worktrees/pull/35
- feat: use the worktree config and cache runtime state by @jubr in https://github.com/jubr/variant-worktrees/pull/36
- feat: keep reads working when the database is down by @jubr in https://github.com/jubr/variant-worktrees/pull/37

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.6...v0.0.7

## [0.0.6] - 2026-11-05

### Added

- `--from` on `create`, `provision`, `up`, and `watch` (the same option on the library and the MCP tools) starts a new variant branch at that commit, tag, or branch. Omit it and the branch starts at `variant.baseBranch`. An existing branch or worktree is left in place. `implode` still merges against `variant.baseBranch`.
- `db.multi` (PostgreSQL): `schemaPrefix` (default `v_${slug}-`) and exactly one of `tenants` and `tenantsCmd`. A variant owns one schema per tenant. `${multi.tenants}` and `${multi.schemaPrefix}` pass the list and the prefix to a step. `list` stays one row; `status`, `list --verbose`, JSON, YAML and MCP carry `schemas`. Schemas left behind with no worktree are grouped by the prefix. The same grouping applies without `db.multi` to PostgreSQL names `v_<slug>-<tenant>` (slug hyphens stored as underscores, tenant after the last hyphen), so `v_fix_entra_vbu_login-de99` and its siblings are one row. `implode` drops those real names, including when the worktree directory is already gone. The VS Code tree marks such a row with a superscript d (a superscript 2 when that glyph cannot be shown).
- `variant deprovision` drops the schema, or every schema under the prefix. A step named `deprovision` replaces that drop. `watch --reprovision` runs it before provisioning again. `down` does not drop.
- A key that `variants.yaml` or `variants.local.yaml` does not know is a warning (`<file>: unknown key <path>` on
  standard error) instead of an error; a value of the wrong type is still an error.
- `variant.ports.range` (`LOW-HIGH`, default `42000-42999`): free ports of watches and of `variant ui` are picked from
  it. An explicit `VARIANT_<KEY>_PORT` may lie anywhere.
- Files that use `variant.instances` or `variant.reservedPorts` still load, with a notice. The
  `variant` CLI and the VS Code extension rewrite `variants.yaml` in place when it is tracked by git and clean, or
  untracked after saving the old text as `variants.yaml~`. `variants.local.yaml` is not rewritten. `VARIANT_MIGRATE=0` or a set `CI` turns the rewrite off. The library, the MCP server
  and `variant ui` never write.
- `variants.yaml` begins with a `yaml-language-server` schema header. The migration of the CLI and the VS Code extension adds it to a file that has no
  schema line (a line you wrote is kept). `.cache/variant/state.yaml` and `runtime.yaml` have no schema line.
- `task package:vsix:unpacked` works in the main checkout.
- `variant init` (and the MCP tool `variant_init`, and `client.init`) writes a `variants.yaml` from autodetection, adds
  `<prefix>*` to `.gitignore` and adds `github:jubr/variant-worktrees` to the Mise configuration; each step can be turned
  off and `--force` replaces an existing file. Secrets are written as `${NAME}` references with a comment naming their
  source. For Postgres, `host`, `port`, `user` and `password` are `${NAME}` and `database` is the detected name.
  `variant.main` and `variant.root` are omitted; `variant config` still prints them. A package with a `watch` script becomes a watch without `kind`.
- VS Code: the command **Variant: Initialize in this Repo** shows an initialization dialog in the Variant Worktrees section, and a
  notification offers it once after a local commit when a database and an application are detected.
- In the Variants tree, a row with a URL has **Open url** immediately left of play or stop. It opens the URL in the
  external browser, or in a Cursor browser tab while Alt is held. After this view starts a watch, the row stays on a
  loading icon until the recorded pid is alive and a GET of the row URL joined with that watch's `ready` path returns
  200, then the row URL opens once. A watch with no URL, or no `ready` path, is not fetched and is not opened. The muted
  explosion writes the colored implode report (added hunk lines green, removed hunk lines red) to the extension output,
  then asks whether to pass `--force`. A failed watch, down, or implode shows the error in a notification.
- MariaDB (`MARIADB_*`, `mariadb://`) is detected as the `mysql` dialect.
- `variant.mise.binPath` (the editor setting and the key of `variants.yaml`) names a Mise executable that is not on `PATH`.
  The extension offers **Trust** when Mise reports an untrusted configuration.

### Changed

- **Breaking:** operational state is `<variant>/.cache/variant/state.yaml` and `runtime.yaml`. `variants.local.yaml` and
  `.cache/variants/<slug>.yaml` are no longer written. An old file is still read when `state.yaml` is absent. A
  `variants.yaml` inside a linked worktree wins over an ancestor file and an `AGENTS.md` symlink. `watch` there runs
  that file's commands and keeps `PORT`, `VARIANT_SPA_PORT` and `VARIANT_API_PORT`.
- **Breaking:** `db.port` accepts a positive integer or a string (digits or one `${NAME}`). The resolved value is a
  positive integer. A string that does not resolve that way still fails. The published JSON schema accepts both.
- **Breaking:** `variant implode` colors added diff hunks green and removed diff hunks red. Command traces stay yellow
  and git's own color stays off.
- **Breaking:** `variant.steps` is a map keyed by step name, with `cmd` instead of `run`. A custom step sets exactly one of `runBefore` and `runAfter`. A list no longer loads. `run` without `cmd` is still read as the command, with a warning.
- `create` records the worktree and the state and does not create a schema. `provision` does, unless a step named `provision` replaces it. `up` no longer drops the database first. `implode` implies `deprovision`.
- The Explorer section starts collapsed and expands when the workspace uses variants or looks ready for them.
  Without a config file it offers **Onboard**. The dialog confirm button is **Initialize**, and **Prefix** sits
  under **Advanced**. **Create variant** sits left of Sort. Sort labels are `Name (A→Z)`, `Name (Z→A)`,
  `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, and `Changed (new→old)`. `main` stays pinned
  first. Down is a hollow dot, watching a filled green dot, and up a different shape. The implode control is an
  explosion, muted when implode would fail. Created order uses `runtime.createdAt` (`YYYY-MM-DD_HH:MM:SS`).
- **Breaking:** the implode report is a dark-yellow `+ <command>` trace around plain `git status --porcelain`,
  `git diff --stat`, and one filtered `git diff -U1` per file. `maxDiffLines` counts those kept patch lines.
  Over the limit the patches are omitted and the status and the stat stay. The text summary after the command
  returns does not repeat the report.
- **Breaking:** `instances` is now `watches` everywhere: `variant.watches`, `runtime.watches`, the fields of records,
  status, list and reports, the MCP tools, the HTTP API and the UI. Environment variables, `${key.port}` and
  container names are unchanged. See the migration above.
- **Breaking:** `variant.reservedPorts` is replaced by `variant.ports.range`; no port is reserved any more.
- **Breaking:** `${NAME}`, `${NAME:-default}` and the variant placeholders (`${slug}`, `${port}`, `${<key>.port}`, ...)
  replace `{{...}}` and work in every string setting, `db` included; `$${` is a literal `${`. Files with `{{...}}` load
  with a notice and are rewritten like the other former names.
- The environment comes from `mise env` only, read lazily and once, merged over the process environment; `mise.local.toml`
  and other Mise files are no longer parsed. `variant list` of a configuration that needs no environment value starts no
  Mise process.
- `kind` and `dir` of a watch are optional; `dir` defaults to the key of the watch.
- The release changelog no longer keeps an empty `Unreleased` heading in the promoted section.
- The GitHub Actions workflows use the Node 24 versions of their actions.
- Play, stop and implode in the Variants view and the panel run in the item's directory (the variant worktree, or the
  main checkout for `main`). `create`, `watch`, `down` and `implode` of an explicit slug started in the variant root use
  the main checkout for git. A `variants.yaml` symlink in that root is skipped and warned about as an anti-pattern.
- A title event for a chat that already existed at startup, and the decision that skips it (`before startup`), are
  logged at Trace. A title event after startup stays at Debug.

### Release notes

- feat: schema warnings, port range, instances to watches, config migration by @jubr in https://github.com/jubr/variant-worktrees/pull/25
- feat: variant init, Mise environment, and editor onboarding by @jubr in https://github.com/jubr/variant-worktrees/pull/26
- feat(api)!: trace dirty worktrees in the implode report by @jubr in https://github.com/jubr/variant-worktrees/pull/27
- fix: watch from the variant root and quiet startup title events by @jubr in https://github.com/jubr/variant-worktrees/pull/28
- feat: make the explorer section easier to use by @jubr in https://github.com/jubr/variant-worktrees/pull/29
- fix(chat-renamer): rename the chat the user is working in by @jubr in https://github.com/jubr/variant-worktrees/pull/30
- feat: postgres multi-schema variants by @jubr in https://github.com/jubr/variant-worktrees/pull/31
- feat: start new variant worktrees at --from by @jubr in https://github.com/jubr/variant-worktrees/pull/32
- feat(variant-vscode): force dirty implode and open row URL by @jubr in https://github.com/jubr/variant-worktrees/pull/33

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.5...v0.0.6

## [0.0.5] - 2026-11-03

### Added

- `task release:prepare` prepares a patch release from `main`: version bump, GitHub-generated release notes in every
  `CHANGELOG*.md`, a `chore(release): v<version>` commit on `release/v<version>`, and a pull request into `main`. The
  parts are `release:check`, `release:changelog` and `release:pr`. It does not tag; the release workflow does at merge.
- `variant completions <shell>` prints a completion script for `zsh`, `bash`, or `fish`. It completes the subcommands,
  their flags, and the slugs of existing variants; the scripts derive from the CLI's own command definitions.
  `variant completions --list-slugs` prints those slugs from local variant state and worktrees.
- The README and the configuration guide describe how each `VARIANT_*` environment variable maps to a
  `variants.yaml` setting or template placeholder, and in which direction it works.
- The Variant Worktrees view sorts by name, created or changed (`variant.sort`, default name ascending). Created is the
  earlier birth time of the variant directory and `.cache/variant/state.yaml` (or `variants.local.yaml` when that cache file is absent); changed is the later modification time. The
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

### Release notes

- ci(release): run publish-extensions after release via workflow_run by @jubr in https://github.com/jubr/variant-worktrees/pull/16
- feat: split variant.main from variant.root; git-ignore worktrees inside main by @jubr in https://github.com/jubr/variant-worktrees/pull/17
- feat(variant-api)!: status command, text output with --json/--yaml, richer list by @jubr in https://github.com/jubr/variant-worktrees/pull/18
- feat(variant-cli)!: variant-cli package, variant-api runs on Node 22.13+ by @jubr in https://github.com/jubr/variant-worktrees/pull/19
- feat: variants view, panel, and variant ui by @jubr in https://github.com/jubr/variant-worktrees/pull/21
- feat(config)!: reshape instance env, url, implode and container settings by @jubr in https://github.com/jubr/variant-worktrees/pull/20
- feat: shell completions for zsh, bash, and fish by @jubr in https://github.com/jubr/variant-worktrees/pull/22
- feat(release): task release:prepare, shorter tagline, drop broken README image by @jubr in https://github.com/jubr/variant-worktrees/pull/23

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.4...v0.0.5

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
