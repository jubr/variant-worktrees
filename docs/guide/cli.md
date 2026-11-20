# CLI

`variant` is the command line of Variant Worktrees, provided by the `variant-cli` package (see [Installation](./installation)).
Each command is explained in [Commands](./commands).
This page holds what belongs to the command line itself: how it takes a slug, how it prints, its shell completions, and `variant mcp`.

## Slug

A slug command takes the slug as a positional argument or as `-s`/`--slug`. The flag wins.
Without either, the slug comes from the current worktree branch.
`--verbose` (`-v`) prints the full output of quiet provisioning steps; on `list` it shows all meta information of every variant.

```bash
variant create -s preview-one
variant provision preview-one
variant watch --detach
```

Commands print text for people. [Global flags](#global-flags) switch to JSON or YAML.

## Completions

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

## MCP server

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
  `--log-level`, `--json` and `--yaml` are accepted and change nothing.
- An unknown option fails before the server starts, with the error on standard error.

## Global flags

These flags work on every command, before or after the command name.
`variant --help` and `variant <command> --help` list them in a `Global flags` section, apart from the flags of the command.

| Flag | Effect |
| --- | --- |
| `-C <path>` | Change directory before configuration is read |
| `--json` | Print the result as JSON, exactly what the command returned |
| `--yaml` | Print the same result as YAML |
| `--log-level` | Print library log lines on standard error from this level: `trace`, `debug`, `info`, `warn`, `error`. `warning` selects `warn`. Default `warn`. A line starts with `[trace]`, `[debug]`, `[info]`, `[warn]`, or `[error]`, then the step when the event has one. On a terminal, with `NO_COLOR` unset, the brackets are dark gray, the level word is colored, and the step is cyan |
| `--help`, `-h` | Show help |
| `--version` | Print the version and a parenthetical (UTC date on `main`, UTC date and time otherwise), then the platform and `https://github.com/jubr/variant-worktrees` (top level only). On a terminal a cursive `Variant-Worktrees` banner and a blank line come before the platform line. A pipe omits both. Off `main`, the version gains `-{slug}-{n}-{hash4}`. On a terminal the banner is orange and its hyphens stay the default color |

The CLI also sends each log event to the editor on the project Unix socket, except steps `ipc` and `cli`, which stay on standard error.
The connection starts at the first event.
Success is one `[debug] ipc connected` line and failure is one `[debug] ipc connect failed: <reason>` line.
CLI end is one `[debug] cli end` line.
Those two stay `debug` even when the working directory is under `/tmp`.
A write waits at most one second.
An event with no slug carries `-s` or `--slug` when that flag was given, and otherwise the autodetected slug of the working directory.
Standard error does not print that slug, and it does not add ` [cli]` or ` @cli`.
A shell command is the message `+"<command>"`.
`+"mise trust --all"`, `+"mise install"`, and `create schema …` are debug.
A lifecycle command adds one info line of the command and the arguments typed after it, such as `watch --from abc --pull-ff=no`.
A missing editor does not change the command result.
On the Variant Worktrees channel a CLI line ends with ` @cli` and an MCP line ends with ` @mcp`.
A library event for a variant whose project directory is under `/tmp` is emitted at `trace`.

Without a flag, commands print a text summary meant for people.
Scripts should use `--json` or `--yaml`; the text layout can change.
Giving both `--json` and `--yaml` fails before anything runs.
Passwords are shown as `***` in every format, and a command that sets an exit code (an attached `watch`) keeps it with every flag.

```bash
variant list --json
variant --yaml status feature-forty-two
```
