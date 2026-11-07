# Configuration

`variants.yaml` at the workspace root holds runtime options. Database settings are autodetected from the environment (see [Environment through Mise](#environment-through-mise)): Postgres, MySQL, MariaDB (`MARIADB_*` or a `mariadb://` URL, dialect `mysql`) and SQLite. Explicit `db` values override those. `variant init` writes the autodetected values into a first `variants.yaml`.

::: v-pre

## Unknown keys and migration

A key `variants.yaml` does not know is a warning, not an error: the command prints `<file>: unknown key <path>` on standard error, one line per key, and runs without it. A value of the wrong type or a missing required value is still an error. `db.port` is a positive integer or a string of digits or one `${NAME}`; after loading it is a positive integer.

When the working directory is inside a variant worktree that contains `variants.yaml` or `variants.yml`, that file is the configuration. An ancestor file and an `AGENTS.md` symlink do not replace it.

`variant.instances` and `variant.reservedPorts` of earlier versions still load, with a notice on standard error (`variant.instances` is now `variant.watches`; `variant.reservedPorts` was dropped, free ports come from `variant.ports.range`). The new name wins when both exist. The `variant` CLI and the VS Code extension rewrite `variants.yaml` in place, keeping comments and layout, when it is tracked by git and has no uncommitted changes; review the change with `git diff` and revert it with `git checkout -- variants.yaml`. A `variants.yaml` that git does not track is rewritten too, after its old text is saved as `variants.yaml~` (nothing happens when that file exists); a tracked file with uncommitted changes is left alone. `variants.local.yaml` is not rewritten. Nothing is rewritten when `CI` is set (other than empty, `0` or `false`) or `VARIANT_MIGRATE=0`; the notice then names the reason. The library, the MCP server and `variant ui` read the old names but never write.

The same migration puts the schema header on top of a `variants.yaml` that has none: `# yaml-language-server: $schema=https://github.com/jubr/variant-worktrees/raw/refs/heads/main/packages/variant-config/variants.yaml.schema.json`, so editors offer completion and validation. A schema line you wrote yourself stays. When the header cannot be added (a tracked file with uncommitted changes, `CI`, `VARIANT_MIGRATE=0`) nothing is printed, because it is cosmetic. `.cache/variant/state.yaml` and `runtime.yaml` have no schema line.

## Watches are a record

`variant.watches` is keyed by watch name. The key is the name in runtime state, in templates (`${be.port}`), in container names (`v-<key>-<slug>`) and in environment variables.

```yaml
variant:
  watches:
    be:
      kind: nestjs
      dir: be
    fe:
      kind: vite
      dir: fe
```

The environment segment of a key is uppercase with every non-alphanumeric character replaced by `_`, so `VARIANT_BE_PORT=62099` pins the port of `be`. Two keys with the same segment are rejected. The key `variant-ui` is reserved for the server of `variant ui`, and so is every key whose segment is `UI` (such as `ui`), because `VARIANT_UI_PORT` is the server's port variable; defining a watch with one fails validation. Watches start in the listed order. List a container that another one reaches by name first: an nginx in a Dockerfile resolves the name of its proxy target when it starts.

## Environment through Mise

The environment is what `mise -C <dir> env --dotenv --quiet` prints, merged over the process environment (a value from Mise wins). It is read once per loaded configuration, and only when a database setting or a `${NAME}` reference is first needed, so a command that needs neither (such as `variant list` of a configuration with an explicit `db.dialect: sqlite`) starts no Mise process. Mise files are not parsed. A Mise that fails stops the command with its message; without any Mise executable the process environment is used alone.

The executable is the first of: the editor setting `variant.mise.binPath`, the key `variant.mise.binPath` of `variants.yaml` (relative to that file), `mise` on `PATH`, then `/opt/homebrew/bin/mise`, `/usr/local/bin/mise`, `/usr/bin/mise`, `/home/linuxbrew/.linuxbrew/bin/mise`, `~/.local/bin/mise`, `~/.local/share/mise/bin/mise` and `~/.cargo/bin/mise`. A configured path that is not an executable file is an error that names where it came from. In the editor, a Mise failure shows one notification per directory and kind of failure; for an untrusted configuration it has a **Trust** button that runs `mise -C <dir> trust --all` and repeats the action.

## Templates

Every string setting is templated, `db` included, with one syntax. Values are expanded in two passes.

1. Variant placeholders: `${slug}`, `${schema}` (the database schema or file), `${storage}`, `${worktree}`, `${url}`, `${port}` and `${<watch>.port}`.
   `${abbr}` is the project abbreviation (see `abbr` below); the default `url` of a detected Vite watch is `http://${slug}.${abbr}.localhost:${port}`.
2. Environment templates: `${NAME}` reads the environment (Mise, then the process) and fails when it is unset, `${NAME:-default}` falls back to `default`. The placeholders of the first pass work inside a default, which is how `${JWT_SECRET:-variant-local-${slug}}` works.

`${multi.tenants}` is the tenant list joined by commas, and `${multi.schemaPrefix}` is `db.multi.schemaPrefix` with `${slug}` filled in. Both are empty when `db.multi` is absent. `${multi.schemaPrefix}` does not run `tenantsCmd`. `${multi.tenants}` runs it the first time a step expands it.

Write `$${` for a literal `${`, for example in a shell command that expands its own variable (`echo $${HOME}`). A `db` setting has no variant, so a variant placeholder there is an error; `db.port` may be `${POSTGRES_PORT}`. `variant init` writes secrets as `${NAME}` references. Files that still use `{{...}}` load as before, with a notice, and the CLI and the editor rewrite them to `${...}` like the other former names above. A `${` that was already in a value is not touched: write `$${` where a shell must see it, since `${NAME}` now reads the environment there.

## Environment variables

Every command also sees the variables below. Some are only set for commands, some are also read from the environment as overrides.

| Variable | Direction | Setting or placeholder |
| --- | --- | --- |
| `VARIANT_SLUG` | set for commands | `${slug}` |
| `VARIANT_TARGET` | set for commands | `${schema}`: the database schema, or the SQLite file |
| `VARIANT_CONFIG` | set for commands | the path of the loaded `variants.yaml` |
| `VARIANT_<KEY>_PORT` | set for commands, and read as an override | `${<key>.port}` and `runtime.watches.<key>.port` |
| `VARIANT_<KEY>_URL` | set for commands, and read as an override | the rendered `url` and `runtime.watches.<key>.url` |
| `VARIANT_<KEY>_PID` | read as an override | `runtime.watches.<key>.pid` |
| `VARIANT_OPEN` | read as an override | `variant.open`; `0` turns opening off and wins |
| `VARIANT_MIGRATE` | read as an override | the rewrite of configuration files that use names of an earlier version; `0` turns it off |
| `VARIANT_ENV_SOURCE` | read as an override | `env.sourceFile`: the file a watch's env file is copied from, instead of the primary worktree's |
| `VARIANT_STEP_<NAME>` | read as an override | the `name` of a step in `variant.steps`; `no` skips the step |
| `VARIANT_UI_PORT` | read as an override | `variant.ui.port`: the port of the `variant ui` server |

`<KEY>` is the key of a watch and `<NAME>` the `name` of a step, with letters uppercased and every other character replaced by `_`: `VARIANT_BE_PORT` for `be`, `VARIANT_STEP_DEMO_USER=no` for `demo-user`. A variable that is set for commands is part of the environment of the install, `up`, step and seed commands and of containers (which receive the variables only, see `container`); an override is read from the environment of the `variant` process.

## When watches are omitted

Without `variant.watches`, Vite and NestJS applications below the configuration directory are detected, and each gets a `watch` command that keeps the console across rebuilds, so several dev servers share one terminal:

| Application | `watch` |
| --- | --- |
| Vite | `bun run dev --clearScreen false` (`bunx --bun vite ...` without a `dev` script) |
| NestJS | `bun run start:dev --preserveWatchOutput` (`bunx nest start --watch ...` without a `start:dev` script) |
| `bun --watch` script | the script with `--no-clear-screen` after `--watch` or `--hot` |

The flag is left out when the project sets it: `clearScreen` in the Vite configuration file, `preserveWatchOutput` in `tsconfig.json`. Watches you list in `variants.yaml` keep exactly the `watch` you give them.

## Options

### `variant`

| Option | Meaning |
| --- | --- |
| `abbr` | A short label of the project for hostnames, lowercase letters and digits optionally separated by `-`. Absent: the first letter or digit of each word of the main checkout's directory name (`variant-worktrees` is `vw`, `OtherTitleCase` is `otc`, `moreStuff` is `ms`, `lower_example` is `le`, no letters at all `app`) |
| `baseBranch` | New variant branches start here; a variant must be merged here before `implode` (default `main`) |
| `branchPrefixes` | The first prefixes a new branch; all are dropped to derive a slug (default `feat/`, `fix/`) |
| `containerEngine` | `docker` or `podman`; `CONTAINER_ENGINE` wins; absent: `docker` if installed, else `podman` |
| `mise` | `{ binPath }`: the Mise executable, when `mise` is not on `PATH`; the editor setting `variant.mise.binPath` wins |
| `main` | The main checkout the worktrees are made from, relative to `variants.yaml`. Default: the directory a parent `AGENTS.md` symlink points into, else the git checkout |
| `open` | `false` prints URLs without opening a browser; `VARIANT_OPEN=0` wins |
| `prefix` | Starts every name derived from a slug, such as worktree directories (default `_v-`) |
| `root` | Directory that holds the worktrees, relative to `variants.yaml`. Default: the directory that holds a parent `AGENTS.md` symlink pointing into `main` (so `variant watch foo` creates `<parent>/_v-foo`), otherwise `main` itself (`./_v-foo`). A worktree directory inside `main` gets `_v-*` added to an existing `.gitignore` when missing; a `.gitignore` is never created |
| `ports` | `{ range }`: `LOW-HIGH` (1024 to 65535, default `42000-42999`) the free ports of watches and of `variant ui` are picked from. An explicit `VARIANT_<KEY>_PORT` or `runtime.watches.<key>.port` may lie anywhere |
| `storage` | `{ dir, envVarName }`: a per-variant directory (default `.storage`) and the variable that carries it (default `STORAGE_ROOT`) |
| `ui` | `{ port }`: the port of the `variant ui` server. `VARIANT_UI_PORT` wins; absent: a free port of `variant.ports.range` |
| `steps` | A map keyed by step name, merged on top of the builtin steps. See below |
| `supervise` | `startDelaySeconds` (2), `readyTimeoutSeconds` (180), `checkoutPollSeconds` (5; 0 turns the check off) |
| `implode` | See below |

`variant.steps` is a map. A name matches `[A-Za-z0-9_-]{2,20}`. The builtin steps `create`, `provision`, `seed`, `watch`, `down`, `deprovision` and `implode` stay in that order; an entry of the same name overlays that step. A custom step has `cmd` and exactly one of `runBefore` and `runAfter`, naming a builtin step or another step. A builtin overlay may omit `cmd`. Either may set `dir` (relative to the worktree), `env` and `filterLinesRegex` (a regular expression: only matching output lines are printed; `--verbose` and failures print everything). A `run` key with no `cmd` is read as `cmd`, with a warning. A list, the former shape, fails validation. Setting `VARIANT_STEP_<NAME>=no` skips the step and prints a `Skipping step` line. The flow is in the [Overview](./overview).

### `db.multi`

One PostgreSQL schema per tenant. Exactly one of `tenants` (text such as `east,west`) and `tenantsCmd` (a shell command, evaluated lazily, whose output is that list). `schemaPrefix` defaults to `v_${slug}-` and is otherwise any non-empty template, so slug `demo` and tenant `east` is the schema `v_demo-east`. The reported target stays `v_<slug>`. A step passes the list and the prefix through its `env` as `${multi.tenants}` and `${multi.schemaPrefix}`. `db.multi` on `mysql` or `sqlite` is refused. The runtime copy of `db` omits `multi`.

```yaml
db:
  dialect: postgres
  host: 127.0.0.1
  multi:
    schemaPrefix: v_${slug}-
    tenantsCmd: sed -rn ${worktree}/server/.env -e 's/^WITCHES=(.*)$/\1/p'
    # tenants: east,west
```

Every command runs after a `+ <command>` line on standard error: the install, `up`, step and seed commands, and the container engine calls of `up`, `down` and the stop before `watch`. The values of the `-e NAME=value` arguments of the engine are printed as `***`. A skipped step prints no command line.

### `variant.implode`

| Option | Meaning |
| --- | --- |
| `preRm` | Glob patterns of files and directories to delete, matched from the project directory and from each watch directory; `${slug}` is replaced. A match that is, or contains, a tracked file stays. Symlinks are not followed. Removed before the report |
| `discard` | Base names of tracked files whose local changes are discarded, after the report |
| `requireMerged` | `false` skips the merge gate (default `true`) |
| `maxDiffLines` | How many kept lines of the filtered `git diff -U1` patches the report includes (default 200). The porcelain status, the stat and the trace lines are not counted. Over the limit every per-file patch is omitted |

`implode` refuses `main`. Unless `force` is given it refuses work that is not an ancestor of `origin/<baseBranch>` (or `<baseBranch>` without a remote branch) and changes nothing. After the gate it stops the runtime, drops the database target, deletes the storage, clears the state, removes the `preRm` matches, prints a report of what the worktree still holds, discards the changes of the `discard` files, removes the worktree, and then removes the local branch. `--branch-rm=no` keeps that branch. `--branch-rm=yes` is the default. The report is a dark-yellow `+ <command>` trace around plain `git status --porcelain`, `git diff --stat`, and one `git diff -U1 <path>` per changed file (the patch starts at the `+++` line). Git's own color is off.

### Watches

| Option | Meaning |
| --- | --- |
| `kind`, `dir` | Both optional. `kind` is `vite` or `nestjs` (a label; autodetection sets it). `dir` is the directory below the worktree, the key of the watch when absent |
| `up`, `watch` | `up` runs while provisioning; `watch` is the process `variant watch` supervises |
| `url` | URL template of the watch |
| `env` | `sourceFile`: an env file in `dir`, copied once for a variant (from the primary worktree's file, its `.example`, or `VARIANT_ENV_SOURCE`). `overrides`: templated values for the watch's commands, written into the copy when it is created together with the storage variable. An existing copy is left alone |
| `install` | Command that runs in `dir` when `dir` has no `node_modules` |
| `ready` | URL path that answers with a success status when the watch serves |
| `container` | How `up` runs the watch |

`container` takes `dockerfile` (relative to the worktree, built with the worktree as context into `v-<key>:v-<slug>`) and `internalPort` (the port inside the container, 80 when absent). The Dockerfile does the rest: build the app, serve it, and reach other containers by name (`v-<key>-<slug>` on the network `v-net-<slug>`); `example/fe/Dockerfile` builds a Vite app and serves it with `nginx:alpine`, proxying `/api/` to the `be` container. The container receives the `VARIANT_*` and database variables only: not `env.overrides`, and neither `SQLITE_DATABASE` nor the storage variable, which are host paths.

## Runtime

`up` and `watch` prepare a variant the same way: ensure the worktree, assign a port to every watch (`VARIANT_<KEY>_PORT`, then `.cache/variant/state.yaml`, then a free port of `variant.ports.range`), prepare the database target and provision. `up` recreates the target; `watch` keeps it. Neither touches the target of `main`.

Only one runtime exists per slug: `watch` removes the containers of the variant, `up` stops its recorded processes. After starting, the commands write `<variant>/.cache/variant/state.yaml` and `runtime.yaml` (`slug`, `mode`, `dir`, `db`, the `watches` with port, pid and URL and, for a detached `watch`, `log`: the path of `.cache/variant/watch.log`, which holds the output of its processes). An old `variants.local.yaml` or `.cache/variants/<slug>.yaml` is read only when `state.yaml` is absent, and is not written again. Attached, the command waits for every `ready` path and opens the URL of each watch with a `url` template.

An attached `watch` ends with exit status 130 on SIGINT or SIGTERM, 1 when one watch ends or the worktree disappears, and 0 only when detached. The CLI sets the process exit code from it.

:::
