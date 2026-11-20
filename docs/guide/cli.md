# CLI

`variant` is the command line of Variant Worktrees, provided by the `variant-cli` package (see [Installation](./installation)).
The commands of a variant are explained in [Commands](./commands), and the lists below link to them.
This page holds what belongs to the command line itself: the commands only it offers and the [global flags](#global-flags) that work on every command, such as `-s` for the slug.

## Basic commands

- [`variant init`](./commands#variant-init)
- [`variant config`](./commands#variant-config)
- [`variant list`](./commands#variant-list)
- [`variant status`](./commands#variant-status)

## Lifecycle commands

- [`variant create`](./commands#variant-create)
- [`variant provision`](./commands#variant-provision)
- [`variant up`](./commands#variant-up)
- [`variant watch`](./commands#variant-watch)
- [`variant down`](./commands#variant-down)
- [`variant deprovision`](./commands#variant-deprovision)
- [`variant implode`](./commands#variant-implode)

## CLI-only commands

### `variant mcp`

Start the MCP server on standard input and output, for an MCP client such as Cursor or Claude.
It serves one [tool](/vscode/mcp) per lifecycle command, with the results as JSON text, and it is what the `mcp.json` of a client runs.
It is part of `variant`: the `variant-cli` package and every compiled executable carry it, and there is no `variant-mcp` executable to install next to them.

```bash
variant mcp
variant mcp --config /workspace/variants.yaml
variant -C /workspace mcp
```

- `--config <path>` loads that `variants.yaml`.
  Omitted, the configuration of the working directory is loaded.
- `-C <path>` changes the working directory first, as it does for every command.
- Standard output carries only the MCP protocol, so `mcp` prints no banner, warning or log line there.
  The server's logs go to the client as MCP logging notifications, and to the editor.
  The other [global flags](#global-flags) (`-s`, `-v`, `--log-level`, `--json`, `--yaml`) are accepted and change nothing.
- An unknown option fails before the server starts, with the error on standard error.

### `variant ui`

Serve the variants app as a web page on a local port, the same app as the Variant Worktrees view and panel of the VS Code extension.
It lists every variant with its state (watching, up, down). `main` stays pinned first.
The run control is the play icon **variant watch** when the variant is down, and a square stop when it is watching or up.
In the editor, after this view starts a watch, the row stays on a loading icon until every watch that has both a URL and a `ready` path has a live pid and a GET of that URL joined with `ready` returns 200.
The extension log records `[watch] {name} URL try {url}` on the first check and `[watch] {name} URL 200 {url}` on the first 200, and does not repeat them.
The external browser opens the row URL once when the last 200 arrives.
A watch with no URL, or no `ready` path, is not fetched and is not opened.
The implode control is an explosion, muted when implode would fail, and `main` has none.
In the editor, a row with a URL has **Open url** immediately left of the run control: it opens that URL in the external browser, and in a Cursor browser tab while Alt is held.
Activating the muted explosion writes the colored implode report to the extension output, then asks whether to pass `--force`; **Force** implodes with force and does not open the clean confirmation.
A failed watch, down, or implode shows that error in a notification.
**Sort** (also the setting `variant.sort`) uses the labels `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, and `Changed (new→old)`.
Created order uses `runtime.createdAt` (`YYYY-MM-DD_HH:MM:SS`).

```bash
variant ui
variant ui --detach
variant ui --stop
```

The port is `VARIANT_UI_PORT`, else [`variant.ui.port`](./configuration#variant-ui-port) from `variants.yaml`, else a free port picked the way a watch's is (from [`variant.ports.range`](./configuration#variant-ports-range)), listens on loopback only and prints `http://ui.<abbr>.localhost:<port>/?token=<token>`.
Without `--detach` it stays attached until interrupted; `--detach` starts it in the background and returns after printing the URL.
`--stop` ends the server of the project and exits 0 when there is none.

There is one server per project.
While it runs, `variant ui` prints its URL and exits 0 instead of starting another, and a recorded server whose process is gone is replaced.
The server records itself in the runtime state of `main` as the watch `variant-ui` with `port`, `pid` and `url` (without the token), so `variant list` and `variant status -s main` show it.
`watch`, `up` and `down` of `main` leave that entry alone.
The key `variant-ui` is reserved, and so is `ui` (its port variable `VARIANT_UI_PORT` is the server's): [`variant.watches`](./configuration#variant-watches) must not define either.

The server is part of `variant`, not a program of its own: the `variant-cli` package and every compiled executable carry it together with the app, so `variant ui` works from the `variant` you run, with nothing installed next to it.

Security model:

- Loopback only, no remote access.
- A random 128-bit token is required.
  The URL carries it once; the server then sets an HttpOnly, SameSite=Strict cookie.
  The token lives in an owner-only file next to the [socket](/vscode/socket-ipc) and is removed when the server ends.
- The `Host` header must name the server (`ui.<abbr>.localhost` or loopback); anything else gets 421, which stops DNS rebinding.
- POST requests must be `application/json` (415 otherwise), so a plain cross-site form cannot start an action.
- `implode` needs `confirm: true` in the request body, and `main` is never imploded.
- A content security policy allows scripts and styles from the server's own origin only.

### `variant completions`

Print a completion script for `zsh`, `bash`, or `fish` to stdout.
It needs no configuration, database, or git repository, and it writes nothing.
The shell argument is required: an unsupported or missing shell fails and names the supported ones.

The scripts complete the subcommands, the flags of each one, and the slugs of existing variants, read live from the local variant state and `_v-*` worktrees (never the database).
Regenerate the script after you upgrade `variant`; the `eval`/`source` forms do it on every shell start.

```bash
# zsh: after compinit, in ~/.zshrc
eval "$(variant completions zsh)"
# or save it where $fpath finds it: variant completions zsh > ~/.zsh/completions/_variant

# bash: in ~/.bashrc
source <(variant completions bash)

# fish
variant completions fish > ~/.config/fish/completions/variant.fish
```

`variant completions --list-slugs` prints the slugs of existing variants, one per line.
The scripts call it while you complete a slug, in the background in `zsh` and in `bash` 4.1 or newer.
The result is kept in shell variables for 30 seconds, never in a file.
It reads local files only, uses the autodetected settings when there is no `variants.yaml`, and prints nothing when the configuration is invalid.

## Global flags

These flags work on every command, before or after the command name: `variant create -s preview-one` and `variant -s preview-one create` are the same command.

| Flag                         | Effect                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-C <path>`                  | Change directory before configuration is read                                                                                                                                                                                                                                                                                                            |
| `-s <slug>`, `--slug <slug>` | The variant to act on. Without it the slug comes from the current worktree branch. A command that takes no slug ignores it. A slug is never a positional argument                                                                                                                                                                                        |
| `--json`                     | Print the result as JSON, exactly what the command returned                                                                                                                                                                                                                                                                                              |
| `--yaml`                     | Print the same result as YAML                                                                                                                                                                                                                                                                                                                            |
| `--log-level`                | Print library log lines on standard error from this level: `trace`, `debug`, `info`, `warn`, `error`. Default `warn`. A line starts with `[trace]`, `[debug]`, `[info]`, `[warn]`, or `[error]`, then the step when the event has one. On a terminal, with `NO_COLOR` unset, the brackets are dark gray, the level word is colored, and the step is cyan |
| `-v`, `-vv`, `-vvv`          | Print log lines on standard error from `info`, `debug` or `trace`. `--log-level` wins when both are given                                                                                                                                                                                                                                                |
| `--help`, `-h`               | Show help. The help of the top level starts with the same text as `--version`                                                                                                                                                                                                                                                                            |
| `--version`                  | Print the version and build date. Off `main`, the version gains `-{slug}-{n}-{hash4}`. On a terminal you also get the colorized banner.                                                                                                                                                                                                                  |

```bash
variant create -s preview-one
variant -s preview-one watch --detach
variant list -vv --json
```

The CLI also sends each log event to the editor on the project Unix socket, if found.
On the Variant Worktrees channel a CLI line ends with `@cli` and an MCP line ends with `@mcp`.
All events for a variant whose project directory is under `/tmp` is emitted at `trace`.

Passwords are shown as `***` in every format, and a command that sets an exit code (an attached `watch`) keeps it with every flag.
