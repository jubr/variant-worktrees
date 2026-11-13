# Core

These are the `variant` commands, provided by the `variant-cli` package (see [Installation](./installation)). A slug command takes the slug as a positional argument or as `-s`/`--slug`. The flag wins. Without either, the slug comes from the current worktree branch. `--verbose` (`-v`) prints the full output of quiet provisioning steps; on `list` it shows all meta information of every variant.

Commands print text for people. [Global flags](#global-flags) switch to JSON or YAML.

What `provision`, `up`, and `watch` actually run is set in [Configuration](./configuration).

## init

Bootstrap the current directory for Variant in up to three steps, each of which `--<step>=false` turns off:

- `file`: write `variants.yaml` with every autodetected value: the database (Postgres, MySQL, MariaDB as dialect `mysql`, or SQLite), `variant.abbr`, `variant.prefix`, and one watch per Vite or NestJS app and per package with a `watch` script. Other accepted values of a setting follow `#` on the same line. Secrets are never written: a password or a URL with credentials becomes `${NAME}` with a comment such as `# from ../mise.local.toml`. For Postgres, `host`, `port`, `user` and `password` are `${NAME}` the same way, and `database` is the detected name. `variant.main` and `variant.root` are omitted.
- `gitignore`: append `<prefix>*` to `.gitignore` (created when absent, left alone when the line exists).
- `mise`: add `github:jubr/variant-worktrees` (`latest`) to the closest Mise file inside the git checkout, skipping `*.local.*` files; `mise.toml` is created when there is none. Nothing is installed. A file that is not valid TOML is left alone and reported, and so is a Mise that cannot be found (the message names where it looked and `variant.mise.binPath`). A failing Mise step stops no other step.

```bash
variant init
variant init --prefix wt- --mise=false
variant init --force
```

`--prefix` (default `_v-`) must not be empty or contain a path separator. `init` refuses to run when a `variants.yaml` or `variants.yml` is found (the lookup of every other command) and changes nothing, unless `--file=false` skips that step or `--force` replaces the `variants.yaml` of this directory. The result lists what each step did; with `--json` or `--yaml` it is the returned object. The MCP tool is `variant_init`. The VS Code extension command **Variant: Initialize in this Repo** shows the same steps; its confirm button is **Initialize**, and **Prefix** sits in a collapsed **Advanced** disclosure. Without a config file the Explorer section offers **Onboard**, which opens that dialog; an activity-bar **Variant Worktrees** tree lists the same rows.

## config

Print the detected configuration: `variants.yaml`, then the environment as Mise prints it, then the process environment. The printed object includes the resolved `variant.main` and `variant.root` even though `init` does not write them. Inside a variant worktree that has its own `variants.yaml` or `variants.yml`, that file is loaded and an ancestor file is not. `db.port` may be a positive integer or a string of digits or one `${NAME}`; the printed value is the resolved integer.

```bash
variant config
```

## create

Create the git worktree and the state for a slug. This does not create a database schema or file; that is `provision`. Creating the same variant again is safe. If PostgreSQL or MySQL cannot be contacted, `create` fails with the contact warning and does not create the worktree.

`--from` is a commit, tag, or branch, and it has no short flag. A new branch starts there. Omit it and the branch starts at `variant.baseBranch`. An existing worktree for the slug, or a branch that already uses any configured prefix, is checked out as it is; `--from` does not move it. `implode` still requires a merge into `variant.baseBranch`. `provision`, `up`, and `watch` take the same flag, because each of them creates the worktree when it is missing.

`--pull-ff` has no short flag. Before a new variant branch is created it fast-forwards the start branch: `from` when that names a local branch, otherwise `variant.baseBranch`. It does not pull the new branch. A tag, a commit, a remote-tracking name, or `HEAD` is used as given, with no fetch. A dry-run that predicts a conflict, divergence, a missing upstream, or another error leaves that checkout un-pulled. When the update fails after a clean dry-run, the checkout is restored and the error prints the command to run again. Omit the flag and nothing is fetched. An existing worktree, an existing prefixed branch, and slug `main` skip the network. `provision`, `up`, and `watch` take the same flag.

`--mise-install` has no short flag. The values are `bg`, `sync`, and `no`. Omit it on `create` and the value is `bg` on the library, the CLI, and MCP. Omit it on `provision` and `watch` and the value is `sync`. The install runs only when the worktree has a Mise config (`mise.toml`, `.mise.toml`, `.config/mise/config.toml`, `mise/config.toml`, or `.tool-versions`). `up` does not take it. There is no `variants.yaml` key. The run is `mise -C <worktree> trust --all`, then `mise install` in that worktree. `bg` returns immediately and replaces `{worktree}/.cache/variant/mise-install.log` with that run. `sync` waits and fails the command when Mise fails; the worktree stays. Slug `main` and a create that makes no worktree skip it.

```bash
variant create -s feature-forty-two
variant create -s feature-forty-two --from feat/other
variant create -s feature-forty-two --pull-ff
variant create -s feature-forty-two --mise-install=sync
```

## list

List the known database variants as a table, one row per variant, with the columns `slug`, `mode`, `uptime`, `url`, `log` and `dir`. `url` is the complete URL of the first watch that has one, `uptime` is how long the longest-running process of the variant has been up, `log` is the absolute path of `.cache/variant/watch.log` while `watch` is running, and `dir` is relative to the variant root. A `-` marks what a variant does not have: a variant started with `up` has no uptime or log. A variant with `db.multi` is still one row; its `schemas` are printed by `status` and by `list -v`, and they are on the JSON and YAML record. Schemas whose worktree is gone are grouped by `schemaPrefix`: the slug is the text before the last separator, and the tenant is the final segment. PostgreSQL schemas named `v_<slug>-<tenant>` group the same way when `db.multi` is absent: hyphens in the slug are stored as underscores, and the tenant is the text after the last hyphen, so `v_fix_entra_vbu_login-de99` and its siblings are one row, `fix-entra-vbu-login`.

```bash
variant list
```

When PostgreSQL or MySQL cannot be contacted, `list` still prints variants known from state files and worktrees and writes one contact warning. Variants that exist only as schemas are left out. A missing SQLite file is not this case. `status` of a slug known that way succeeds; a slug known only from the database fails with the same warning.

With `-v`/`--verbose` every variant is printed as `variant status` prints it, with all its meta information, instead of the table. `-v` is not a log level.

```bash
variant list -v
variant list --json   # the records, without the runtime object
variant list -v --json
```

## status

Show everything known about one variant: the facts `list` shows plus `.cache/variant/runtime.yaml`: `mode`, the worktree directory, the database settings (the password is shown as `***`), and for every watch its port, pid, URL, whether the process is `alive`, and its uptime. It also shows the path of that file and the log file of a running `watch`. `VARIANT_<KEY>_*` overrides do not apply. It fails when nothing is known about the slug. An old `variants.local.yaml` is read only when `state.yaml` is absent.

```bash
variant status feature-forty-two
variant status -s feature-forty-two --json
```

## provision

Create the schema, or every schema of `db.multi`, and run the configured install, env file, `up`, step, and seed commands. A step named `provision` replaces the builtin schema creation and runs once. This prepares the variant without leaving a supervised `watch` in the foreground.

```bash
variant provision -s feature-forty-two
variant provision -s feature-forty-two --from feat/other
```

`--from` starts a new branch at that commit. `--pull-ff` fast-forwards the start branch first. `--mise-install` installs Mise tools in the new worktree. See [create](#create).

## up

Run the watches as containers. This implies `seed`, so the worktree, the schemas and the seed exist first. It does not drop an existing schema. One runtime exists per slug, so this stops recorded `watch` processes for that variant first.

```bash
variant up -s feature-forty-two
variant up -s feature-forty-two --from feat/other
```

`--from` starts a new branch at that commit. `--pull-ff` fast-forwards the start branch first. See [create](#create).

## down

Stop the processes and containers of a variant and keep its data, database, and worktree.

```bash
variant down -s feature-forty-two
```

## watch

Run the watches as supervised host processes. This removes the variant's containers first, so `up` and `watch` do not both run.

```bash
variant watch -s feature-forty-two
variant watch -s feature-forty-two --detach
variant watch -s feature-forty-two --reprovision
variant watch -s feature-forty-two --from feat/other
```

`--from` starts a new branch at that commit. `--pull-ff` fast-forwards the start branch first. `--mise-install` installs Mise tools in the new worktree. See [create](#create).

`--reprovision` runs `deprovision` before the provision phase, so the schemas are dropped and created again. Without it, `watch` does not drop a schema.

Inside a variant worktree that has its own `variants.yaml`, `watch` runs the commands of that file and keeps the environment it finds (`PORT`, `VARIANT_SPA_PORT`, `VARIANT_API_PORT`). Without `--detach`, the command stays attached. It exits 130 on interrupt, 1 when a watch ends or the worktree disappears, and 0 only when detached. The start summary, including the pids, is printed as soon as the processes are running. The exit code is printed when the watch ends. `--detach` starts the processes in the background and returns. Attached and detached, the output of all its processes goes to one log file, `.cache/variant/watch.log` in the worktree. The file is emptied when the watch starts. Each process is announced as `[name] command`, and each later line is prefixed `[name] `. Attached, stdout stays on stdout and stderr stays on stderr, with the same prefix, and the file is written without waiting for that write. `output.mode: tty` gives that process a pseudo-terminal, so color is in the log; the terminal mixes stderr into those stdout lines. Otherwise the watch runs with pipes and a warning. A line that contains an ANSI escape gets a reset before the newline, and the log starts with `[watch] {args} mode=tty # set to 'no-tty' likely suppresses ansi escape sequences`, where `{args}` is the invocation flags such as `--detach`. `no-tty` keeps the pipes. Omit `output.mode` and the editor uses `tty` when an enabled extension's description contains both `log` and `ansi`, otherwise `no-tty`. The CLI does not see extensions, so an omitted mode stays `no-tty`. The file grows while the processes run, so `tail -f` follows it. `list` and `status` show its path. `down` removes `log` from state and keeps the file. `up` writes no log and records no `log`. The first probe of a watch that sets `ready` writes `[watch] {name} URL try {url}` to stderr and, when `watch` is writing the log, to that file. The first status 200 writes `[watch] {name} URL 200 {url}` once. On a terminal, once every ready watch has returned 200, stderr gains `[watch] Interactive:   1 restart   2 detach   3 quit   (press number + ⏎)`. The numbers are bold cyan, the words are yellow, and the parenthetical is dark gray. `1` restarts the processes, `2` leaves them running and returns, and `3` stops them and returns. That hint is not written to the log. A later poll does not repeat either line. Status 204 does not count. `{url}` is the rendered watch URL joined with `ready`, or `http://127.0.0.1:<port><ready>` when the watch has no URL template. Detach writes no try line and opens nothing. State is written to `.cache/variant/state.yaml` and `.cache/variant/runtime.yaml`.

## deprovision

Stop the watches, then drop the schema `v_<slug>`. With `db.multi`, drop every schema under the expanded `schemaPrefix`. A step named `deprovision` replaces that drop and runs once. `VARIANT_STEP_DEPROVISION=no` skips the step and does not fall back to the builtin drop. The worktree, the storage directory and the state stay. It refuses `main`.

```bash
variant deprovision -s feature-forty-two
```

## implode

Stop the variant, drop its schemas and storage, clear its state, remove its worktree, and then remove its local branch. This implies `deprovision`. It refuses `main`, and it refuses work that is not merged into `variant.baseBranch` unless `--force` is set. `--branch-rm=yes|no` chooses the branch step. The default is `yes`. `--branch-rm=no` keeps the branch. `true` and `false` are rejected. With `--log-level=debug`, stderr names the branch and whether it was removed or kept. The default log threshold hides that line. The report it prints colors added diff hunks green and removed diff hunks red; command traces stay yellow, and git's own color stays off. A worktree directory that is already gone does not block the drop: the schemas still go, and a later `implode` of the same slug succeeds. The drop uses the real schema names of that row, including `v_<slug>-<tenant>` leftovers. `.cache/variant/state.yaml` and `runtime.yaml` are removed and the old `variants.local.yaml` is not recreated.

```bash
variant implode -s feature-forty-two
variant implode -s feature-forty-two --branch-rm=no
variant implode -s feature-forty-two --force
```

## ui

Serve the variants app as a web page on a local port, the same app as the Variant Worktrees view and panel of the VS Code extension. It lists every variant with its state (watching, up, down). `main` stays pinned first. The run control is the play icon **variant watch** when the variant is down, and a square stop when it is watching or up. In the editor, after this view starts a watch, the row stays on a loading icon until every watch that has both a URL and a `ready` path has a live pid and a GET of that URL joined with `ready` returns 200. The extension log records `[watch] {name} URL try {url}` on the first check and `[watch] {name} URL 200 {url}` on the first 200, and does not repeat them. The external browser opens the row URL once when the last 200 arrives. A watch with no URL, or no `ready` path, is not fetched and is not opened. The implode control is an explosion, muted when implode would fail, and `main` has none. In the editor, a row with a URL has **Open url** immediately left of the run control: it opens that URL in the external browser, and in a Cursor browser tab while Alt is held. Activating the muted explosion writes the colored implode report to the extension output, then asks whether to pass `--force`; **Force** implodes with force and does not open the clean confirmation. A failed watch, down, or implode shows that error in a notification. **Sort** (also the setting `variant.sort`) uses the labels `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, and `Changed (new→old)`. Created order uses `runtime.createdAt` (`YYYY-MM-DD_HH:MM:SS`).

```bash
variant ui
variant ui --detach
variant ui --stop
```

The port is `VARIANT_UI_PORT`, else `variant.ui.port` from `variants.yaml`, else a free port picked the way a watch's is (from `variant.ports.range`), listens on loopback only and prints `http://ui.<abbr>.localhost:<port>/?token=<token>`. Without `--detach` it stays attached until interrupted; `--detach` starts it in the background and returns after printing the URL. `--stop` ends the server of the project and exits 0 when there is none.

There is one server per project. While it runs, `variant ui` prints its URL and exits 0 instead of starting another, and a recorded server whose process is gone is replaced. The server records itself in the runtime state of `main` as the watch `variant-ui` with `port`, `pid` and `url` (without the token), so `variant list` and `variant status main` show it. `watch`, `up` and `down` of `main` leave that entry alone. The key `variant-ui` is reserved, and so is `ui` (its port variable `VARIANT_UI_PORT` is the server's): `variant.watches` must not define either.

The server is part of `variant`, not a program of its own: the npm package and every compiled executable carry it together with the app, so `variant ui` works from the `variant` you run, with nothing installed next to it.

Security model:

- Loopback only, no remote access.
- A random 128-bit token is required. The URL carries it once; the server then sets an HttpOnly, SameSite=Strict cookie. The token lives in an owner-only file next to the [editor socket](./ipc) and is removed when the server ends.
- The `Host` header must name the server (`ui.<abbr>.localhost` or loopback); anything else gets 421, which stops DNS rebinding.
- POST requests must be `application/json` (415 otherwise), so a plain cross-site form cannot start an action.
- `implode` needs `confirm: true` in the request body, and `main` is never imploded.
- A content security policy allows scripts and styles from the server's own origin only.

## completions

Print a completion script for `zsh`, `bash`, or `fish` to stdout. It needs no configuration, database, or git repository, and it writes nothing. The shell argument is required: an unsupported or missing shell fails and names the supported ones.

The scripts complete the
subcommands, the flags of each one, and the slugs of existing variants, read live from the local variant state and
`_v-*` worktrees (never the database). Regenerate the script after you upgrade `variant`; the `eval`/`source` forms do
it on every shell start.

```bash
# zsh: after compinit, in ~/.zshrc
eval "$(variant completions zsh)"
# or save it where $fpath finds it: variant completions zsh > ~/.zsh/completions/_variant

# bash: in ~/.bashrc
source <(variant completions bash)

# fish
variant completions fish > ~/.config/fish/completions/variant.fish
```

`variant completions --list-slugs` prints the slugs of existing variants, one per line. The scripts call it while you complete a slug, in the background in `zsh` and in `bash` 4.1 or newer. The result is kept in shell variables for 30 seconds, never in a file. It reads local files only, uses the autodetected settings when there is no `variants.yaml`, and prints nothing when the configuration is invalid.

## Global flags

These flags work on every command, before or after the command name. `variant --help` and `variant <command> --help` list them in a `Global flags` section, apart from the flags of the command.

| Flag | Effect |
| --- | --- |
| `--json` | Print the result as JSON, exactly what the command returned |
| `--yaml` | Print the same result as YAML |
| `--log-level` | Print library log lines on standard error from this level: `trace`, `debug`, `info`, `warn`, `error`. `warning` selects `warn`. Default `warn`. A line starts with `[trace]`, `[debug]`, `[info]`, `[warn]`, or `[error]`, then the step when the event has one. On a terminal, with `NO_COLOR` unset, the brackets are dark gray, the level word is colored, and the step is cyan |
| `--help`, `-h` | Show help |
| `--version` | Print the version and a parenthetical (UTC date on `main`, UTC date and time otherwise), then the platform and `https://github.com/jubr/variant-worktrees` (top level only). On a terminal a cursive `Variant-Worktrees` banner and a blank line come before the platform line. A pipe omits both. Off `main`, the version gains `-{slug}-{n}-{hash4}`. On a terminal the banner is orange and its hyphens stay the default color |

The CLI also sends each log event to the editor on the project Unix socket, except steps `ipc` and `cli`, which stay on standard error. The connection starts at the first event. Success is one `[debug] ipc connected` line and failure is one `[debug] ipc connect failed: <reason>` line. CLI end is one `[debug] cli end` line. Those two stay `debug` even when the working directory is under `/tmp`. A write waits at most one second. An event with no slug carries `-s` or `--slug` when that flag was given, and otherwise the autodetected slug of the working directory. Standard error does not print that slug, and it does not add ` [cli]` or ` @cli`. A shell command is the message `+"<command>"`. A missing editor does not change the command result. On the Variant Worktrees channel a CLI line ends with ` @cli` and an MCP line ends with ` @mcp`. A library event for a variant whose project directory is under `/tmp` is emitted at `trace`.

Without a flag, commands print a text summary meant for people. Scripts should use `--json` or `--yaml`; the text layout can change. Giving both `--json` and `--yaml` fails before anything runs. Passwords are shown as `***` in every format, and a command that sets an exit code (an attached `watch`) keeps it with every flag.

```bash
variant list --json
variant --yaml status feature-forty-two
```
