# Core

These are the `variant` commands. A slug command takes the slug as a positional argument or as `-s`/`--slug`. The flag wins. Without either, the slug comes from the current worktree branch. `--verbose` (`-v`) prints the full output of quiet provisioning steps; on `list` it shows all meta information of every variant.

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

Run the configured install, dotenv, `up`, step, and seed commands. This prepares the variant without leaving a supervised `watch` in the foreground.

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
