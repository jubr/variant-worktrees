# Core

These are the `variant` commands, provided by the `variant-cli` package (see [Installation](./installation)). A slug command takes the slug as a positional argument or as `-s`/`--slug`. The flag wins. Without either, the slug comes from the current worktree branch. `--verbose` (`-v`) prints the full output of quiet provisioning steps; on `list` it shows all meta information of every variant.

Commands print text for people. [Global flags](#global-flags) switch to JSON or YAML.

What `provision`, `up`, and `watch` actually run is set in [Configuration](./configuration).

## config

Print the detected configuration: `variants.yaml`, then `mise.local.toml`, then environment variables.

```bash
variant config
```

## create

Create or refresh a database variant and its worktree. Creating the same isolated variant again is safe.

```bash
variant create -s feature-forty-two
```

## list

List the known database variants as a table with the columns `slug`, `mode`, `uptime`, `url`, `log` and `dir`. `url` is the complete URL of the first instance that has one, `uptime` is how long the longest-running process of the variant has been up, `log` is the absolute path of the log file of its detached watch, and `dir` is relative to the variant root. A `-` marks what a variant does not have: a variant started with `up` has no uptime or log.

```bash
variant list
```

With `-v`/`--verbose` every variant is printed as `variant status` prints it, with all its meta information, instead of the table.

```bash
variant list -v
variant list --json   # the records, without the runtime object
variant list -v --json
```

## status

Show everything known about one variant: the facts `list` shows plus the `runtime` section of its `variants.local.yaml`: `mode`, the worktree directory, the database settings (the password is shown as `***`), and for every instance its port, pid, URL, whether the process is `alive`, and its uptime. It also shows the path of the runtime file and the log file of a detached watch. `VARIANT_<KEY>_*` overrides do not apply. It fails when nothing is known about the slug.

```bash
variant status feature-forty-two
variant status -s feature-forty-two --json
```

## provision

Run the configured install, env file, `up`, step, and seed commands. This prepares the variant without leaving a supervised `watch` in the foreground.

```bash
variant provision -s feature-forty-two
```

## up

Recreate the database and run the instances as containers. One runtime exists per slug, so this stops recorded `watch` processes for that variant first.

```bash
variant up -s feature-forty-two
```

## down

Stop the processes and containers of a variant and keep its data, database, and worktree.

```bash
variant down -s feature-forty-two
```

## watch

Run the instances as supervised host processes. This removes the variant's containers first, so `up` and `watch` do not both run.

```bash
variant watch -s feature-forty-two
variant watch -s feature-forty-two --detach
```

Without `--detach`, the command stays attached. It exits 130 on interrupt, 1 when an instance ends or the worktree disappears, and 0 only when detached. `--detach` starts the processes in the background and returns. Detached, the output of all its processes goes to one log file, `variants.watch.log` in the worktree next to `variants.local.yaml`: the file is emptied when the watch starts, each process gets a `[key] command` line, and the output arrives while the processes run, so `tail -f` follows it in real time. `list` and `status` show its path; `down` keeps the file. An attached watch writes no log file, its output stays on the console.

## implode

Stop the variant, drop its database and storage, clear its state, and remove its worktree. This includes `down`. It refuses `main`, and it refuses work that is not merged into `variant.baseBranch` unless `--force` is set. The branch itself stays.

```bash
variant implode -s feature-forty-two
variant implode -s feature-forty-two --force
```

## ui

Serve the variants app as a web page on a local port, the same app as the Variant Worktrees view and panel of the VS Code extension. It lists every variant with its state (watching, up, down) in name order and offers variant watch (the play icon), stop and implode. In the editor, **Sort** (also the setting `variant.sort`) orders the Explorer view and the panel by name, created or changed. The trash icon is at the right of every row except `main`: theme foreground when implode would succeed, red when it would fail.

```bash
variant ui
variant ui --detach
variant ui --stop
```

The port is `VARIANT_UI_PORT`, else `variant.ui.port` from `variants.yaml`, else a free port picked the way an instance's is (reserved ports are never picked), listens on loopback only and prints `http://ui.<abbr>.localhost:<port>/?token=<token>`. Without `--detach` it stays attached until interrupted; `--detach` starts it in the background and returns after printing the URL. `--stop` ends the server of the project and exits 0 when there is none.

There is one server per project. While it runs, `variant ui` prints its URL and exits 0 instead of starting another, and a recorded server whose process is gone is replaced. The server records itself in the runtime state of `main` as the instance `variant-ui` with `port`, `pid` and `url` (without the token), so `variant list` and `variant status main` show it. `watch`, `up` and `down` of `main` leave that entry alone. The key `variant-ui` is reserved, and so is `ui` (its port variable `VARIANT_UI_PORT` is the server's): `variant.instances` must not define either.

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

`variant completions --list-slugs` prints the slugs of existing variants, one per line. The scripts call it while you complete a slug, in the background in `zsh` and in `bash` 4.1 or newer. The result is kept in shell variables for 30 seconds, never in a file. It reads local files only, and prints nothing when no configuration can be loaded.

## Global flags

These flags work on every command, before or after the command name. `variant --help` and `variant <command> --help` list them in a `Global flags` section, apart from the flags of the command.

| Flag | Effect |
| --- | --- |
| `--json` | Print the result as JSON, exactly what the command returned |
| `--yaml` | Print the same result as YAML |
| `--help`, `-h` | Show help |
| `--version` | Show the version (top level only) |

Without a flag, commands print a text summary meant for people. Scripts should use `--json` or `--yaml`; the text layout can change. Giving both `--json` and `--yaml` fails before anything runs. Passwords are shown as `***` in every format, and a command that sets an exit code (an attached `watch`) keeps it with every flag.

```bash
variant list --json
variant --yaml status feature-forty-two
```
