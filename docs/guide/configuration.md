# Configuration

`variants.yaml` at the workspace root holds runtime options. Database settings load from `mise.local.toml` first, then environment variables. Explicit `db` values override those.

::: v-pre

## Instances are a record

`variant.instances` is keyed by instance name. The key is the name in runtime state, in templates (`{{be.port}}`), in container names (`v-<key>-<slug>`) and in environment variables.

```yaml
variant:
  instances:
    be:
      kind: nestjs
      dir: be
    fe:
      kind: vite
      dir: fe
```

The environment segment of a key is uppercase with every non-alphanumeric character replaced by `_`, so `VARIANT_BE_PORT=62099` pins the port of `be`. Two keys with the same segment are rejected. Instances start in the listed order. List a container that another one reaches by name first: an nginx in a Dockerfile resolves the name of its proxy target when it starts.

## Templates

Values of `env.overrides` and `url` are rendered in two passes.

1. Variant placeholders: `{{slug}}`, `{{schema}}` (the database schema or file), `{{storage}}`, `{{worktree}}`, `{{url}}`, `{{port}}` and `{{<instance>.port}}`.
2. Environment templates: `{{NAME}}` reads the environment and fails when it is unset, `{{NAME:-default}}` falls back to `default`. The placeholders of the first pass work inside a default, which is how `{{JWT_SECRET:-variant-local-{{slug}}}}` works.

## Environment variables

Every command also sees the variables below. Some are only set for commands, some are also read from the environment as overrides.

| Variable | Direction | Setting or placeholder |
| --- | --- | --- |
| `VARIANT_SLUG` | set for commands | `{{slug}}` |
| `VARIANT_TARGET` | set for commands | `{{schema}}`: the database schema, or the SQLite file |
| `VARIANT_CONFIG` | set for commands | the path of the loaded `variants.yaml` |
| `VARIANT_<KEY>_PORT` | set for commands, and read as an override | `{{<key>.port}}` and `runtime.instances.<key>.port` |
| `VARIANT_<KEY>_URL` | set for commands, and read as an override | the rendered `url` and `runtime.instances.<key>.url` |
| `VARIANT_<KEY>_PID` | read as an override | `runtime.instances.<key>.pid` |
| `VARIANT_OPEN` | read as an override | `variant.open`; `0` turns opening off and wins |
| `VARIANT_ENV_SOURCE` | read as an override | `env.sourceFile`: the file an instance's env file is copied from, instead of the primary worktree's |
| `VARIANT_STEP_<NAME>` | read as an override | the `name` of a step in `variant.steps`; `no` skips the step |

`<KEY>` is the key of an instance and `<NAME>` the `name` of a step, with letters uppercased and every other character replaced by `_`: `VARIANT_BE_PORT` for `be`, `VARIANT_STEP_DEMO_USER=no` for `demo-user`. A variable that is set for commands is part of the environment of the install, `up`, step and seed commands and of containers (which receive the variables only, see `container`); an override is read from the environment of the `variant` process.

## When instances are omitted

Without `variant.instances`, Vite and NestJS applications below the configuration directory are detected, and each gets a `watch` command that keeps the console across rebuilds, so several dev servers share one terminal:

| Application | `watch` |
| --- | --- |
| Vite | `bun run dev --clearScreen false` (`bunx --bun vite ...` without a `dev` script) |
| NestJS | `bun run start:dev --preserveWatchOutput` (`bunx nest start --watch ...` without a `start:dev` script) |
| `bun --watch` script | the script with `--no-clear-screen` after `--watch` or `--hot` |

The flag is left out when the project sets it: `clearScreen` in the Vite configuration file, `preserveWatchOutput` in `tsconfig.json`. Instances you list in `variants.yaml` keep exactly the `watch` you give them.

## Options

### `variant`

| Option | Meaning |
| --- | --- |
| `baseBranch` | New variant branches start here; a variant must be merged here before `implode` (default `main`) |
| `branchPrefixes` | The first prefixes a new branch; all are dropped to derive a slug (default `feat/`, `fix/`) |
| `containerEngine` | `docker` or `podman`; `CONTAINER_ENGINE` wins; absent: `docker` if installed, else `podman` |
| `main` | The main checkout the worktrees are made from, relative to `variants.yaml`. Default: the directory a parent `AGENTS.md` symlink points into, else the git checkout |
| `open` | `false` prints URLs without opening a browser; `VARIANT_OPEN=0` wins |
| `prefix` | Starts every name derived from a slug, such as worktree directories (default `_v-`) |
| `root` | Directory that holds the worktrees, relative to `variants.yaml`. Default: the directory that holds a parent `AGENTS.md` symlink pointing into `main` (so `variant watch foo` creates `<parent>/_v-foo`), otherwise `main` itself (`./_v-foo`). A worktree directory inside `main` gets `_v-*` added to an existing `.gitignore` when missing; a `.gitignore` is never created |
| `reservedPorts` | Ports that are never picked for an instance (default 3000, 4200, 5432) |
| `storage` | `{ dir, envVarName }`: a per-variant directory (default `.storage`) and the variable that carries it (default `STORAGE_ROOT`) |
| `steps` | Named commands that run between the `up` commands and the seed command |
| `supervise` | `startDelaySeconds` (2), `readyTimeoutSeconds` (180), `checkoutPollSeconds` (5; 0 turns the check off) |
| `implode` | See below |

A step has a unique `name` (letters, digits, `_` and `-`), a shell command `run`, an optional `dir` (relative to the worktree), `env` and `filterLinesRegex` (a regular expression: only matching output lines are printed; `--verbose` and failures print everything). Setting `VARIANT_STEP_<NAME>=no` skips the step and prints a `Skipping step` line.

Every command runs after a `+ <command>` line on standard error: the install, `up`, step and seed commands, and the container engine calls of `up`, `down` and the stop before `watch`. The values of the `-e NAME=value` arguments of the engine are printed as `***`. A skipped step prints no command line.

### `variant.implode`

| Option | Meaning |
| --- | --- |
| `preRm` | Glob patterns of files and directories to delete, matched from the project directory and from each instance directory; `{{slug}}` is replaced. A match that is, or contains, a tracked file stays. Symlinks are not followed. Removed before the report |
| `discard` | Base names of tracked files whose local changes are discarded, after the report |
| `requireMerged` | `false` skips the merge gate (default `true`) |
| `maxDiffLines` | The report holds the full `git diff` up to this many lines (default 200) |

`implode` refuses `main`. Unless `force` is given it refuses work that is not an ancestor of `origin/<baseBranch>` (or `<baseBranch>` without a remote branch) and changes nothing. After the gate it stops the runtime, drops the database target, deletes the storage, clears the state, removes the `preRm` matches, prints `git status` and `git diff`, discards the changes of the `discard` files and removes the worktree. The branch stays.

### Instances

| Option | Meaning |
| --- | --- |
| `kind`, `dir` | `vite` or `nestjs`, and the directory below the worktree |
| `up`, `watch` | `up` runs while provisioning; `watch` is the process `variant watch` supervises |
| `url` | URL template of the instance |
| `env` | `sourceFile`: an env file in `dir`, copied once for a variant (from the primary worktree's file, its `.example`, or `VARIANT_ENV_SOURCE`). `overrides`: templated values for the instance's commands, written into the copy when it is created together with the storage variable. An existing copy is left alone |
| `install` | Command that runs in `dir` when `dir` has no `node_modules` |
| `ready` | URL path that answers with a success status when the instance serves |
| `container` | How `up` runs the instance |

`container` takes `dockerfile` (relative to the worktree, built with the worktree as context into `v-<key>:v-<slug>`) and `internalPort` (the port inside the container, 80 when absent). The Dockerfile does the rest: build the app, serve it, and reach other containers by name (`v-<key>-<slug>` on the network `v-net-<slug>`); `example/fe/Dockerfile` builds a Vite app and serves it with `nginx:alpine`, proxying `/api/` to the `be` container. The container receives the `VARIANT_*` and database variables only: not `env.overrides`, and neither `SQLITE_DATABASE` nor the storage variable, which are host paths.

## Runtime

`up` and `watch` prepare a variant the same way: ensure the worktree, assign a port to every instance (`VARIANT_<KEY>_PORT`, then `variants.local.yaml`, then a free unreserved port), prepare the database target and provision. `up` recreates the target; `watch` keeps it. Neither touches the target of `main`.

Only one runtime exists per slug: `watch` removes the containers of the variant, `up` stops its recorded processes. After starting, the commands record `runtime` in the `variants.local.yaml` of the variant's worktree (`slug`, `mode`, `dir`, `db`, the `instances` with port, pid and URL and, for a detached `watch`, `log`: the path of `variants.watch.log`, which holds the output of its processes) and, attached, wait for every `ready` path and open the URL of each instance with a `url` template.

An attached `watch` ends with exit status 130 on SIGINT or SIGTERM, 1 when one instance ends or the worktree disappears, and 0 only when detached. The CLI sets the process exit code from it.

:::
