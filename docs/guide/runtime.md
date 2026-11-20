# Runtime

A watch is one dev process or container of a variant: a Vite app, a NestJS server, anything with a `watch` command.
This page is about how watches behave once `variant watch` or `variant up` starts them: ports, state files, output, keys, exit status, and the environment they see.
Which watches exist is in [Configuration](./configuration#variant-watches); the commands are in [`variant watch`](./commands#variant-watch).
In the editor, the [Extension](/vscode/extension) starts and stops watches for you, and the CLI reports to it over [Socket IPC](/vscode/socket-ipc).

::: v-pre

## Starting

`up` and `watch` prepare a variant the same way: ensure the worktree, assign a port to every watch (`VARIANT_<KEY>_PORT`, then `.cache/variant/state.yaml`, then a free port of [`variant.ports.range`](./configuration#variant-ports-range)), prepare the database target and provision.
Neither touches the target of `main`.

Only one runtime exists per slug.
After starting, the commands write `<variant>/.cache/variant/state.yaml` and `runtime.yaml` (`slug`, `mode`, `dir`, `db`, the `watches` with port, pid and URL and, for attached or detached `watch`, `log`: the path of `.cache/variant/watch.log`).
Each line in that file is prefixed `[name]`.

Watches start in the listed order.
Attached, the command waits for every `ready` path to return status 200 and opens the URL of each watch with a `url` template.
The first probe writes `[watch] {name} URL try {url}` and the first 200 writes `[watch] {name} URL 200 {url}` once, to stderr and to the log.

Every command runs after a `+ <command>` line on standard error: the install, `up`, step and seed commands, and the container engine calls of `up`, `down` and the stop before `watch`.
The values of the `-e NAME=value` arguments of the engine are printed as `***`.
A skipped step prints no command line.

## Watching

How an attached or detached [`variant watch`](./commands#variant-watch) behaves once its processes run.
`watch` removes the containers of the variant before it starts them, and it keeps the database target.

### Interactive keys

On a terminal, once every ready watch has returned 200, stderr gains `[watch] Interactive: 1 restart 2 detach 3 quit (press number + ⏎)`.
The numbers are bold cyan, the words are yellow, and the parenthetical is dark gray.
`1` restarts the processes, `2` leaves them running and returns, and `3` sends Ctrl+C to every watch and waits.
A second Ctrl+C at least 1 second later sends SIGTERM and returns.
Any other line is written to each watch's stdin. Ctrl+C before `3` stops the processes.
The line stays off the log, and off a pipe.

### Reattaching

A second `watch` while those processes are still running leaves them running and prints `[watch] # already running: reattached, showing last 50 lines`, the last 50 log lines, the URL 200 lines, and the command line.
Without `--detach` it then follows new log lines, accepts `1`, `2`, and `3`, and writes any other line to the watches' stdin.
An interrupt exits 130 and leaves the processes running. `--detach` returns after that report.

### Exit status

An attached `watch` ends with exit status 130 on SIGINT or SIGTERM, 1 when one watch ends or the worktree disappears, and 0 only when detached.
The CLI sets the process exit code from it.
A detached `watch` that sees its worktree disappear cleans up and ends on its own, see [Worktree removed](#worktree-removed).

### Worktree removed

A `watch`, attached or detached, checks every [`checkoutPollSeconds`](./configuration#variant-supervise-checkoutpollseconds) that the worktree directory it was started for is still the same directory.
Removing the worktree with `variant implode` or by hand ends the watch.
A directory that a watch process recreates below the removed path is not the worktree.
The watch then stops every process with its descendants and implodes the variant.
That drops the database target and the containers and removes the state file, and works when the directory is already gone.
It keeps the local branch, because a directory that was removed by hand may have been the only copy of unmerged commits.
The `main` variant only has its processes stopped.
From that moment nothing is written below the removed path: no `watch.log`, no `in.sock`, no state files.

One `warn` event with the step `watch-cleanup` says the path is gone and what follows.
Before each action after it a `debug` event with that step names what it stops or removes: each process with its pid, the state file, the database target, `git worktree prune` and the kept branch.
Under a temporary directory all of them are `trace`. A failed implode is another `warn`.
The CLI treats them like its other log events.
A detached watch writes them to the stderr of the command that started it, when that is a terminal or a file.
A pipe is left alone, so a script that reads the output of `variant watch --detach` until its end does not wait for the watch.

## Up

[`variant up`](./commands#variant-up) goes through `create`, `provision` and `seed` like `watch`, see the [flow of steps](./overview#flow-of-steps).
It then runs the watches as containers, see [`container`](./configuration#variant-watches-key-container).
It does not drop an existing schema.
It stops the processes recorded for the slug, where `watch` removes the containers.
It records no `log` in `runtime.yaml`.

::: info Disclaimer
`up` is not thoroughly tested, YMMV. PRs welcome!
:::

## Environment through Mise

The environment is what `mise -C <dir> env --dotenv --quiet` prints, merged over the process environment (a value from Mise wins).
It is read once per loaded configuration, and only when a database setting or a `${NAME}` reference is first needed, so a command that needs neither (such as `variant list` of a configuration with an explicit `db.dialect: sqlite`) starts no Mise process.
Mise files are not parsed.
A Mise that fails stops the command with its message; without any Mise executable the process environment is used alone.

The executable is the first of: the editor setting [`variant.mise.binPath`](./configuration#variant-mise-binpath), the key [`variant.mise.binPath`](./configuration#variant-mise-binpath) of `variants.yaml` (relative to that file), `mise` on `PATH`, then `/opt/homebrew/bin/mise`, `/usr/local/bin/mise`, `/usr/bin/mise`, `/home/linuxbrew/.linuxbrew/bin/mise`, `~/.local/bin/mise`, `~/.local/share/mise/bin/mise` and `~/.cargo/bin/mise`.
A configured path that is not an executable file is an error that names where it came from.
In the editor, a Mise failure shows one notification per directory and kind of failure; for an untrusted configuration it has a **Trust** button that runs `mise -C <dir> trust --all` and repeats the action.

### Bun on `PATH`

Mise does not set `PATH` for the commands Variant runs, so they find the `bun` of the process that started `variant`.
When another install is listed before the Mise directories (a user-level Bun, a package-manager shim), your steps and watches run a Bun other than the one `mise.toml` pins.
Before the first host command of `provision`, `up` and `watch`, Variant compares `bun --version` of the first `bun` on `PATH` with the version `mise ls --current --json bun` reports for the project directory.
When they differ, it logs one warning that names both versions and paths and the directory to move behind the Mise ones, followed by a hint on how to solve it: how that Bun was probably installed and how to remove it (`rm -rf ~/.bun` for the official installer, `brew uninstall bun`, `npm uninstall -g bun`, or deleting the executable), and each line of `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` or `~/.config/fish/config.fish` that is not a comment and adds that directory to `PATH`, as `<file>:<line>: <text>`.
The files are only read.
`variant init` runs the same check at onboarding and reports it as `bun` in its result, so the hint is there before the first `watch`.
Nothing is changed or stopped.
There is no warning without a Mise executable, when Mise pins no Bun, when no `bun` is on `PATH`, or when the versions are equal (a symlink or a second install of the pinned version is fine).

## Environment variables

Every command also sees the variables below.
Some are only set for commands, some are also read from the environment as overrides.

| Variable | Direction | Setting or placeholder |
| --- | --- | --- |
| `VARIANT_SLUG` | set for commands | `${slug}` |
| `VARIANT_TARGET` | set for commands | `${schema}`: the database schema, or the SQLite file |
| `VARIANT_CONFIG` | set for commands | the path of the loaded `variants.yaml` |
| `VARIANT_<KEY>_PORT` | set for commands, and read as an override | `${<key>.port}` and `runtime.watches.<key>.port` |
| `VARIANT_<KEY>_URL` | set for commands, and read as an override | the rendered `url` and `runtime.watches.<key>.url` |
| `VARIANT_<KEY>_PID` | read as an override | `runtime.watches.<key>.pid` |
| `VARIANT_OPEN` | read as an override | [`variant.open`](./configuration#variant-open); `0` turns opening off and wins |
| `VARIANT_MIGRATE` | read as an override | the rewrite of configuration files that use names of an earlier version; `0` turns it off |
| `VARIANT_ENV_SOURCE` | read as an override | `env.sourceFile`: the file a watch's env file is copied from, instead of the primary worktree's |
| `VARIANT_STEP_<NAME>` | read as an override | the `name` of a step in [`variant.steps`](./configuration#variant-steps); `no` skips the step |
| `VARIANT_UI_PORT` | read as an override | [`variant.ui.port`](./configuration#variant-ui-port): the port of the `variant ui` server |

`<KEY>` is the key of a watch and `<NAME>` the `name` of a step, with letters uppercased and every other character replaced by `_`: `VARIANT_BE_PORT` for `be`, `VARIANT_STEP_DEMO_USER=no` for `demo-user`.
A variable that is set for commands is part of the environment of the install, `up`, step and seed commands and of containers (which receive the variables only, see `container`); an override is read from the environment of the `variant` process.

## When watches are omitted

Without [`variant.watches`](./configuration#variant-watches), Vite and NestJS applications below the configuration directory are detected, and each gets a `watch` command that keeps the console across rebuilds, so several dev servers share one terminal:

| Application | `watch` |
| --- | --- |
| Vite | `bun run dev --clearScreen false` (`bunx --bun vite ...` without a `dev` script) |
| NestJS | `bun run start:dev --preserveWatchOutput` (`bunx nest start --watch ...` without a `start:dev` script) |
| `bun --watch` script | the script with `--no-clear-screen` after `--watch` or `--hot` |

The flag is left out when the project sets it: `clearScreen` in the Vite configuration file, `preserveWatchOutput` in `tsconfig.json`.
Watches you list in `variants.yaml` keep exactly the `watch` you give them.

:::
