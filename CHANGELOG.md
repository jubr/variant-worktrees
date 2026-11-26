# Changelog

## Unreleased

### Changed

- **Breaking:** `db.filename` is now `db.database`, for SQLite the full absolute or relative file name (see the [Database guide](docs/guide/database.md)). The migration rewrites `db.filename` in `variants.yaml` and in the runtime state, keeps the value as written, and keeps `db.database` when a file has both. A relative name now resolves in the worktree of the variant, not in the directory of `variants.yaml`: write an absolute path to keep a file where it is.
- The default SQLite file of a variant is `.cache/variants/{slug}.sqlite` in its worktree (the main checkout for `main`), the same for `init`, `config`, `create`, `status`, `list` and the editor, where `create` made `.cache/variants/{slug}.db` beside `variants.yaml`. `{slug}` in `db.database` stands for the slug. A variant other than `main` whose file would be the file of `main` fails and names the slug and `db.database`.
- A `variants.yaml` without `db.database` next to `.cache/variants/*.db` files of the former location is migrated: it gets `db.database: <directory>/.cache/variants/{slug}.db`, so those databases stay in use. Delete the line to move to `.sqlite`.
- `variant create` prints `Created <slug>`, `worktree:` and `database:` (relative SQLite file unless `db.database` is absolute, or a `postgres://` or `mysql://` connection with the password as `***`, and a `schema:` line for those). `variant status` and `variant list --verbose` print the same, and the `variant list` table ends with a `database` column. `target` and `dialect` are no longer printed in text; `--json` keeps them and adds `database`.
- The database environment variables `SQLITE_DATABASE`, `SQLITE_PATH` and a `sqlite:` `DATABASE_URL` are detected as `db.database`, and `variant init` writes no `db` key for a defaulted SQLite database.
- The documentation has a Database page after CLI, with a configuration example, file layout and `mise.local.toml` for PostgreSQL, MySQL and MariaDB, and SQLite. Configuration now precedes CLI in the sidebar.

- `variant init` writes no `db` key when it detects no database (autodetection resolves SQLite on its own), and the file it writes starts with the `yaml-language-server` schema header, so the next `variant` command or editor load no longer rewrites it and leaves a `variants.yaml~` behind.
- The mise step of `variant init` adds `"packslip:jubr/variant-worktrees" = "latest"`. A Mise configuration that already lists `github:jubr/variant-worktrees` counts as listing the tool and is not given a second entry.
- `variant watch` removes clear-screen ANSI sequences (erase display `ESC[J`, cursor home `ESC[H`, terminal reset `ESC c`) from the lines it writes to `.cache/variant/watch.log` and to standard output, in every output mode. A line that held only those sequences is not written. Color and other sequences are kept.
- `publish-extensions.yaml` publishes to the Visual Studio Marketplace through trusted publishing (`vsce publish --oidc`) instead of the `VSCE_PAT` secret, which is no longer used. The Marketplace needs a Trusted Publishing policy for the workflow `publish-extensions.yaml` and the environment `marketplace`.

### Fixed

- In the editor, play, stop and implode read `variants.yaml` again when it changed since the library was first used in that folder. Before, a watch added by `variant init` or by hand was not started until the window was reloaded, and play only logged that no watch has a watch command.
- The Bun-on-`PATH` warning no longer tells you to delete a Bun that Mise installed. For another Mise version first on `PATH` it says the `PATH` was probably inherited from a process with another project's Mise environment, and to start the editor or terminal again from a shell without it.

## [0.0.13] - 2026-11-25

### Added

- `task package:cli` and `task bleed:cli` choose the Bun runtime of each target and print which: `VARIANT_BUN_RUNTIME` (one target), else the slim runtime fetched from the newest [`jubr/bun-slim`](https://github.com/jubr/bun-slim) release `bun-slim-vX.Y.Z-N` of exactly the Bun version `mise.toml` pins (Linux and macOS), else the default runtime `bun-dist`. A missing release, a failed download or a bad checksum is a warning; Windows has no slim runtime and says so as information. `ci-release.yaml` compiles each `variant` executable in its own job with that, so it needs no fetch step. `bun scripts/fetch-bun-slim.ts <platform>` still fetches by hand.
- Every compile job of `ci-release.yaml` writes a Markdown table of KB sizes to its step summary: the default runtime (`bun-dist`), the slim runtime and its saving, the added code bundle, and the saving of the compiled `variant`.
- The library and CLI job of `ci-branch.yaml` compiles `variant` for linux-x64 and checks that `--version` names the slim runtime of the Bun version `mise.toml` pins, so a branch fails early when `jubr/bun-slim` has no build of it.
- `VARIANT_BUN_RUNTIME=<executable>` makes `task bleed:cli` and `task package:cli` embed that Bun runtime in the compiled `variant` instead of the fetched or default one. A missing or non-executable file fails before compiling and names the path; `task package:cli:all` refuses the variable.
- `task chore:bun:bump [VERSION=1.4.6]` moves `mise.toml`, the `@types/bun` ranges and `bun.lock` to the Bun version of the newest `jubr/bun-slim` release, or to `VERSION`, and commits `chore(bun): bump to vX.Y.Z`.
- `variant mcp [--config <path>]` starts the stdio MCP server from the `variant` command (CLI, `variant-cli` package and every compiled executable). Standard output carries only the MCP protocol. See [`variant mcp`](docs/guide/cli.md#variant-mcp).

### Changed

- `variant --version` names the runtime and its version between the platform and the repository URL: `node`, `bun-v1.4.5`, `bun-standalone-v1.4.5-0` or `bun-slim-v1.4.5-0` (the number after the version is the `jubr/bun-slim` build), as in `macos-arm64, bun-slim-v1.4.5-0, https://github.com/jubr/variant-worktrees`. The help header carries it too.
- The docs start from Installation: the Overview lists Installation as the first step of the flow and ends with *Next steps*, and the sidebar puts Installation right after Overview. Installation is three steps (install and activate mise; the extension or `mise x packslip:jubr/variant-worktrees@ -- variant init`; review `variants.yaml`) with example output, and links to [`variant init`](docs/guide/commands.md#variant-init) instead of repeating it.
- The *Custom Steps* and *Custom multi-tenancy steps* sections moved from the Overview to the Configuration page, before *Templates*. *Custom Steps* says that several steps with the same `runBefore` or `runAfter` run in the order they are written in `variants.yaml`, and shows what `variant watch` runs for a step with `runAfter: watch`.
- **BREAKING (docs URLs):** `overview#custom-steps` and `overview#custom-multi-tenancy-steps` are now `configuration#custom-steps` and `configuration#custom-multi-tenancy-steps`; the Installation heading anchors changed with the new step headings.
- `-s`/`--slug` is a global flag: `variant create -s preview-one` and `variant -s preview-one create` are the same, and a command that takes no slug ignores it. **BREAKING:** the positional slug (`variant provision preview-one`) is gone and fails with a hint to use `-s`.
- `-v`, `-vv` and `-vvv` set the log level to `info`, `debug` and `trace`. **BREAKING:** `-v` is no longer the short form of `--verbose`; use `--verbose`. `--log-level` still takes `warning` as `warn`, but the help and the docs no longer name it.
- `variant --help` starts with the same extended version text as `variant --version`.
- The CLI page of the docs ends with the global flags, which now hold the slug; the separators between the Configuration options have a little more room.
- **BREAKING (docs URLs):** the command headings of the docs are ``variant <name>``, so the anchors are `commands#variant-create` and so on instead of `commands#create`. `cli#mcp-server` and `cli#completions` are now `cli#variant-mcp` and `cli#variant-completions`, and `variant ui` moved from Commands to the CLI page. Commands has the sections Basic commands and Lifecycle commands, and the CLI page lists them and ends with CLI-only commands. The options of the Configuration page are separated by a rule.
- Every command definition has a `section` (`basic` or `lifecycle`) that says where the docs list it; the CLI-only commands are in section `cli`.
- **BREAKING:** the `variant-mcp` executable is gone, and so are `task bleed:mcp` and `vw-bleeds/variant-mcp`. Point MCP clients at `variant` with the argument `mcp`: `"command": "variant", "args": ["mcp", "--config", "/workspace/variants.yaml"]`. The `variant-mcp` package is a library now, started by `variant mcp`. Remove a leftover `vw-bleeds/variant-mcp` by hand.
- The help of `variant` no longer pads its lines with trailing spaces, so GNU screen shows no empty line between the global flags.
- The code of each CLI command lives in `packages/variant-cli/src/commands/`.

### Fixed

- A `watch` whose worktree directory disappears (`variant implode`, or a directory removed by hand) now cleans up, attached and detached: it stops its processes and implodes the variant, keeping the local branch, and writes nothing below the removed path, so `.cache/variant/` is not recreated. A detached watch checks every `variant.supervise.checkoutPollSeconds` as an attached one does. One `warn` event with step `watch-cleanup` says the worktree is gone, and a `debug` event names each step before it runs, each removed path included; under a temporary directory all are `trace`. See [Worktree removed](docs/guide/runtime.md#worktree-removed).

### Release notes

- test: stop leaking watch processes and bound hung test runs by @jubr in https://github.com/jubr/variant-worktrees/pull/81
- feat(variant-api): watch cleans up when its worktree disappears by @jubr in https://github.com/jubr/variant-worktrees/pull/82
- feat: start the MCP server with variant mcp by @jubr in https://github.com/jubr/variant-worktrees/pull/83
- docs: group commands, global -s/--slug and -v, extended --help by @jubr in https://github.com/jubr/variant-worktrees/pull/84
- docs: getting started, Installation first, custom steps in Configuration by @jubr in https://github.com/jubr/variant-worktrees/pull/86
- feat: slim Bun runtime for compiled variant executables by @jubr in https://github.com/jubr/variant-worktrees/pull/85

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.12...v0.0.13

## [0.0.12] - 2026-11-19

### Release notes

- docs: restructure the site, remove variant.seed and the API reference by @jubr in https://github.com/jubr/variant-worktrees/pull/79

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.11...v0.0.12

## [0.0.11] - 2026-11-18

### Added

- `provision`, `up` and `watch` log one warning when the first `bun` on the command `PATH` is another version than the one Mise pins for the project, naming both versions and paths, with a hint on how to solve it: the removal command for how that Bun was installed and the lines of your shell startup files that add its directory to `PATH`. Nothing is changed or stopped. See [Bun on PATH](docs/guide/runtime.md#bun-on-path).
- `variant init` (CLI, MCP tool `variant_init` and the editor onboarding) runs the same check and reports it in its result as `bun` (`matches`, `differs` or `unchecked`, with `message` and `hint`). It never fails `init`.

### Changed

- Documentation: every key of `variants.yaml` named in the docs links to its heading (`variant.watches.<key>.dir`, `db.multi`, `chatRenamer.awake.when`), and every `variant.<key>.<subkey>` has an `<h3>` of its own on Configuration. Chat Renamer configuration has the same structure, and Configuration lists the templates in a table.
- Documentation: the Overview explains `create`, `provision`, `watch`, `down`, `deprovision` and `implode` in a few words and ends each with a link to its Core section. The MCP page has a heading and a parameter table per tool. Runtime has a Watching section (interactive keys, reattaching, exit status) and a separate Up section. The Library page moved after Building and links into Configuration.
- Documentation: code no longer uses font ligatures, so `VARIANT_STEP_<STEP>=no` is shown as typed instead of with a `≥`.
- Documentation: Configuration has the sections Variant options, Chat Renamer options and Database options, and its templates table shows an example value instead of the pass. Core groups Lifecycle commands and Other commands, the MCP page has no Testing section, and `chatRenamer.activationPatterns` lists its defaults. `up` is documented as going through `create`, `provision` and `seed` like `watch`, with its disclaimer as an info panel.
- Documentation: every sentence of the prose under `docs/` is on its own line, short ones sharing a line below 100 characters (`task docs:sentences` rewrites, a test checks). The READMEs use absolute links only (`task docs:readme-links` rewrites, a test checks that they resolve) and no longer name earlier configuration names or tell you to install with `npm`: Mise is the way.
- Documentation tests check that every key of the `variants.yaml` schema has a heading, and that every internal link and fragment of the built site resolves, including navigation, sidebar and links written as raw HTML, which the VitePress dead-link check does not see.

### Fixed

- `${worktree}` always expands to an absolute, normalized path, however the worktree was spelled to the run. This keeps a setting such as `SQLITE_DATABASE: '${worktree}/.cache/variant/${schema}.sqlite'` on one file.

### Removed

- The top-level `variants` key of `variants.yaml` (a per-variant seed override per slug) is gone, in the schema, the loader and the docs. Use `variant.seed` or a `seed` step. A file that still has the key loads, and the key is reported as unknown.

### Release notes

- fix(variant-api): absolute worktree placeholder and bun-on-PATH warning by @jubr in https://github.com/jubr/variant-worktrees/pull/75
- fix(variant-vscode): ship icon-128.png so the onboarding panel icon loads by @jubr in https://github.com/jubr/variant-worktrees/pull/77
- docs: cross-linked, structured documentation and the variants key removed by @jubr in https://github.com/jubr/variant-worktrees/pull/76

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.10...v0.0.11

## [0.0.10] - 2026-11-17

### Changed

- Documentation: Installation is about adding Variant Worktrees to your existing project, with the mise CLI first (`mise x github:jubr/variant-worktrees@latest -- variant init`) and the extension second; no page tells you to `npm install` any more, and the library and MCP server are installed from a checkout under Development.
- Documentation: Runtime is a page of its own (watches, state, interactive keys, environment through Mise, detection when `variant.watches` is omitted). Configuration opens with the options, one heading per `variant.<key>`, alphabetical, and ends with Templates and Unknown keys and migration.
- Documentation: a new sidebar group VSCode / Cursor holds the new Extension page, the MCP Server and Socket IPC (`/guide/ipc` is now `/guide/socket-ipc`). The Library page is code examples that link into Core, and sits in Development between Building and the API Reference.
- Documentation: the site is relocatable. Stylesheets, scripts, favicons, the logo and page links are relative to their page (VitePress `base: './'`, so `vitepress` is pinned to `2.0.0-alpha.21`), and the same build works under `/variant-worktrees/` or any other path.
- Documentation: the "On this page" outline lists second- and third-level headings, so every `variant.<key>` option of Configuration is in it.
- The example `be` writes to the SQLite file in `SQLITE_DATABASE`: it creates the table `events` when absent, prints `sqlite: opened <path>` when it opens the file, records a `startup` row when it listens and a `request` row (`GET /api 200`) for every request it answers.
- The example project's scripts are renamed: `dev` of `example/fe` is `app:watch`, and `start:dev` of `example/be` is `server:watch`. `example/variants.yaml` and `example/README.md` use the new names.
- A command no longer creates an empty `.cache/variants/` directory. It exists only when a file is written into it, such as a default-location SQLite database. An existing directory and its legacy state files are read as before.
- The repository's own `variants.yaml` is committed. Its watches `example-be` and `example-fe` each get their variant `PORT`, and `example-fe` gets the port of `example-be` in `VARIANT_API_PORT`. `example-be` keeps its SQLite file at `${worktree}/.cache/variant/${schema}.sqlite`.
- `awake.cmd` runs whatever command is set, not only `/usr/bin/caffeinate -disu -w ${extensionHostPid}`. It is split on spaces and run without a shell, and `${extensionHostPid}` is replaced with the host's pid. The command is tried once at startup for up to 1 second with no chat running. A command that cannot be executed, or exits within 1 second, logs one `[awake]` warning per command, right after the startup line when it fails at startup. A command that does not wait on `${extensionHostPid}` can outlive a host that is killed. Changing `awake.cmd` while a chat is in a turn replaces the process with the new command.
- The editor socket `.vscode/variant-worktrees.sock` is removed when the extension host exits without a clean deactivation, as long as the process still runs its exit handlers. A killed host (SIGKILL) still leaves the file, and the next start replaces it.
- Stopping the socket listener, and so deactivating the extension, no longer waits for clients that keep a connection open. Those connections are closed.

### Release notes

- fix(variant-ipc): remove the editor socket on stop with clients and on process exit by @jubr in https://github.com/jubr/variant-worktrees/pull/68
- feat(hk): nested per-package hk with check:changed/all/full by @jubr in https://github.com/jubr/variant-worktrees/pull/69
- fix(ci): package the vsix as a late workflow step by @jubr in https://github.com/jubr/variant-worktrees/pull/70
- feat(chat-renamer): run any awake.cmd, warn once when it fails by @jubr in https://github.com/jubr/variant-worktrees/pull/71
- feat(example): commit root variants.yaml, rename watch scripts, sqlite events by @jubr in https://github.com/jubr/variant-worktrees/pull/72
- docs: spruce up the documentation and make the site relocatable by @jubr in https://github.com/jubr/variant-worktrees/pull/73

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.9...v0.0.10

## [0.0.9] - 2026-11-13

### Added

- `-C <path>` changes directory before configuration is read. There is no long option.
- Awake follows this window's turn events and also polls the first 20 last-focused composers every 5 seconds. The startup line names `agentHost+poll` or `poll`. `variant.log.highVolumeCategories` is an opt-in checkbox list whose first entry is `awake.agentHostEvents`.
- `chatRenamer.awake.cmd` replaces `awake.what`. The default is the detected `/usr/bin/caffeinate -disu -w ${extensionHostPid}`.
- `awake.graceDelaySecs` defaults to `180`.
- A focused file inside the main checkout or a variant worktree highlights that row in a visible Variant Worktrees tree and does not take editor focus.

### Changed

- `+"mise trust --all"`, `+"mise install"`, and `create schema …` are debug. A lifecycle command logs one info line of the command and the arguments typed after it, such as `watch --from abc --pull-ff=no`. `config` does not.
- `task bleed:cli` writes `vw-bleeds/variant-cli/bin/variant-<version>-<slug>-<n>-<hash4>` and points `bin/variant` at that file. That version and slug keep the three newest binaries. Other versions and slugs stay. On `main` the file is `bin/variant-<version>`.
- A `tty` watch allocates a terminal in process on Bun, then tries `mise exec -- bun`, `mise exec bun@latest -- bun`, `bun` on `PATH`, and `script`, and otherwise runs with pipes and a warning.
- Omitted `--mise-install` stays `bg` on `create`. On `provision` and `watch` the omitted value is `sync`, so those commands wait for `mise install`. Pass `--mise-install=bg` to keep the background run.
- An attached `watch` on a terminal prints `[watch] Interactive:   1 restart   2 detach   3 quit   (press number + ⏎)` once every ready watch has returned 200. The numbers are bold cyan, the words are yellow, and the parenthetical is dark gray. `1` restarts the processes and keeps listening, `2` leaves them running and returns the shell, and `3` sends Ctrl+C to every watch and waits. A second Ctrl+C at least 1 second later sends SIGTERM and returns the shell. The line is not written to the watch log.
- A second `watch` leaves live processes running. It prints `[watch] # already running: reattached, showing last 50 lines`, the last 50 lines of `.cache/variant/watch.log`, `[watch] {name} URL 200 {url}` for each ready watch that answers 200, and the command line. Without `--detach` it then follows new log lines, accepts `1`, `2`, and `3`, and writes any other line to the watches' stdin. Ctrl+C on the first watch stops its processes.
- `variant config` prints YAML with an origin comment on each value: `# from <path>` for the loaded file (relative to the working directory), `# from env NAME` for an environment variable, `# autodetect <reason>` or `# autodetect from <source>` for a discovered value, or `# default` for a built-in. A shared origin is commented on the parent only, including items of an array. A comment that only repeats its key is omitted, and `source` is not printed. On a terminal, with `NO_COLOR` unset, keys, strings, numbers, booleans, and comments use the same colors as yq. A pipe or any `NO_COLOR` value, including empty, keeps the comments and drops the color. `--json` and `--yaml` stay plain. A password is `***` in all three.

### Release notes

- feat(vscode): highlight the variant of the active file by @jubr in https://github.com/jubr/variant-worktrees/pull/62
- feat(chat-renamer): follow turn events while awake by @jubr in https://github.com/jubr/variant-worktrees/pull/63
- feat(variant-cli): change directory with -C before config is read by @jubr in https://github.com/jubr/variant-worktrees/pull/64
- feat: comment where variant config values come from by @jubr in https://github.com/jubr/variant-worktrees/pull/65
- feat: native tty watches with reattach and SIGINT quit by @jubr in https://github.com/jubr/variant-worktrees/pull/66

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.8...v0.0.9

## [0.0.8] - 2026-11-11

### Added

- `variant.watches.<name>.output.mode` is `tty` or `no-tty`. `tty` starts that process on a pseudo-terminal, so color is written to `.cache/variant/watch.log`. A colored line gets an ANSI reset before the newline. The log starts with one line `[watch] {args} mode=tty # set to 'no-tty' likely suppresses ansi escape sequences`, where `{args}` is the invocation flags such as `--detach`. `no-tty` keeps pipes. When the mode is omitted, the extension uses `tty` if an enabled extension's description contains both `log` and `ansi`, and `no-tty` otherwise. The CLI does not see extensions, so an omitted mode stays `no-tty`.
- Chat Renamer holds the Mac awake with one `caffeinate` process per host while a chat in that host is taking a turn or generating, including tool work of that turn. A chat in another workspace does not count. `awake.when` is `chatsActive` (default) or `never`. `awake.what` `screen` (default) runs `caffeinate -disu -w <host-pid>`; `cpu` runs `caffeinate -dis -w <host-pid>`. The child exits when that host exits. `awake.graceDelaySecs` (default `60`, `0` stops at once) keeps that process after the last turn. An open, selected, or idle chat does not count. The enable setting does not turn this off.
- `variant-log` is the shared log event: a level, a message, and an optional slug and step. The library, the editor socket, and MCP emit on it. The CLI is the only place that colors a line.
- The Variant Worktrees extension registers the `variant` MCP server for the open workspace in Cursor and VS Code. The `mcp.json` snippet stays the setup for other clients.
- `--mise-install` on `create`, `provision`, and `watch` (library and MCP `miseInstall`, values `bg`, `sync`, and `no`, no short flag). Omit it and the value is `bg`. The install runs only when the worktree has a Mise config, and only from `create`; `provision` and `watch` pass the flag through. `up` does not take it, and there is no configuration-file key. The run is `trust --all`, then `install`, in the worktree. `bg` returns immediately and writes `{worktree}/.cache/variant/mise-install.log`. `sync` waits and fails the command when Mise fails; the worktree stays. Slug `main` and a create that makes no worktree skip it.
- `--pull-ff` on `create`, `provision`, `up`, and `watch` (library `pullFf`, MCP `pullFf`, no short flag) fast-forwards the start branch before a new variant branch is created. It does not pull the new branch. The start branch is `from` when that names a local branch, otherwise `variant.baseBranch`. A tag, commit, remote-tracking name, or `HEAD` is used as given. A dry-run that predicts a conflict, divergence, a missing upstream, or another error leaves that checkout un-pulled. When the update fails after a clean dry-run, the checkout is restored and the error includes the command to run again. Omit the flag and nothing is fetched. An existing worktree, an existing prefixed branch, and slug `main` skip the network.
- A release created from `main` attaches `packslip.sigstore.json` for the six `variant` executables. The signing job has `contents: read`.

### Changed

- Attached and detached `watch` prefix each line with `[name]` and write `.cache/variant/watch.log`. The file is emptied when the watch starts. `down` keeps the file and clears `log` from state. `up` writes no log.
- The first ready probe writes `[watch] {name} URL try {url}` and the first status 200 writes `[watch] {name} URL 200 {url}` once. Status 204 is not ready. Detach writes neither line and opens nothing.
- In the Variants tree, the loading icon stays until every watch that has a URL and a `ready` path returns 200. The extension log records those two debug lines. The row URL opens once when the last 200 arrives.
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

### Release notes

- feat: publish local bleeds beside the checkout by @jubr in https://github.com/jubr/variant-worktrees/pull/39
- feat(cli): print the version banner and build time by @jubr in https://github.com/jubr/variant-worktrees/pull/40
- docs(agents): spell out variant lifecycle by @jubr in https://github.com/jubr/variant-worktrees/pull/42
- Initialize onboarding in the main checkout by @jubr in https://github.com/jubr/variant-worktrees/pull/43
- ci(release): sign variant executables with packslip by @jubr in https://github.com/jubr/variant-worktrees/pull/44
- feat: fast-forward the start branch with --pull-ff by @jubr in https://github.com/jubr/variant-worktrees/pull/45
- feat: remove the local branch on implode by @jubr in https://github.com/jubr/variant-worktrees/pull/46
- feat: install Mise tools when creating a worktree by @jubr in https://github.com/jubr/variant-worktrees/pull/47
- feat(vscode): register the MCP server from the extension by @jubr in https://github.com/jubr/variant-worktrees/pull/48
- feat: consolidate logs onto one event by @jubr in https://github.com/jubr/variant-worktrees/pull/49
- Record workflow rules and fix CLI text by @jubr in https://github.com/jubr/variant-worktrees/pull/51
- fix(variant-vscode): expand the section without taking focus by @jubr in https://github.com/jubr/variant-worktrees/pull/52
- feat(chat-renamer): hold the Mac awake during a chat turn by @jubr in https://github.com/jubr/variant-worktrees/pull/50
- test(cli): expect sanitized version slug by @jubr in https://github.com/jubr/variant-worktrees/pull/54
- test: colocate package specs and nest cursor modules by @jubr in https://github.com/jubr/variant-worktrees/pull/55
- Log quietly in temporary directories and quote shell commands by @jubr in https://github.com/jubr/variant-worktrees/pull/56
- feat: share one watch log and wait for the last ready URL by @jubr in https://github.com/jubr/variant-worktrees/pull/57
- fix(chat-renamer): reap caffeinate with the host by @jubr in https://github.com/jubr/variant-worktrees/pull/58
- fix(chat-renamer): ignore a leftover generation id by @jubr in https://github.com/jubr/variant-worktrees/pull/59
- fix(chat-renamer): treat unfinished runs as active by @jubr in https://github.com/jubr/variant-worktrees/pull/60

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.7...v0.0.8

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
