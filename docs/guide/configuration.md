# Configuration

`variants.yaml` at the workspace root holds runtime options. Database settings load from `mise.local.toml` first, then environment variables. Explicit `db` values override those.

::: v-pre

## Instances are a record

`variant.instances` is keyed by instance name. The key is the name in runtime state, in templates (`{{port.be}}`), in container names (`v-<key>-<slug>`) and in environment variables.

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

The environment segment of a key is uppercase with every non-alphanumeric character replaced by `_`, so `VARIANT_BE_PORT=62099` pins the port of `be`. Two keys with the same segment are rejected. Instances start in the listed order. List a container that another one proxies to first: a static site resolves its proxy target by name when it starts.

## Templates

Values of `env`, `envAlways`, `container.env`, `container.volumes` and `open` are rendered in two passes.

1. Variant placeholders: `{{slug}}`, `{{schema}}` (the database schema or file), `{{storage}}`, `{{worktree}}`, `{{url}}`, `{{port}}` and `{{port.<instance>}}`.
2. Environment templates: `{{NAME}}` reads the environment and fails when it is unset, `{{NAME:-default}}` falls back to `default`. The placeholders of the first pass work inside a default, which is how `{{JWT_SECRET:-variant-local-{{slug}}}}` works.

Every command also sees `VARIANT_SLUG`, `VARIANT_TARGET`, the database settings (`POSTGRES_*`, `MYSQL_*` or `SQLITE_DATABASE`), the storage variable, and the port and URL of every instance as `VARIANT_<KEY>_PORT` and `VARIANT_<KEY>_URL`.

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
| `open` | `false` prints URLs without opening a browser; `VARIANT_OPEN=0` wins |
| `prefix` | Starts every name derived from a slug, such as worktree directories (default `_v-`) |
| `reservedPorts` | Ports that are never picked for an instance (default 3000, 4200, 5432) |
| `storage` | `{ dir, env }`: a per-variant directory (default `.storage`) and the variable that carries it (default `STORAGE_ROOT`) |
| `steps` | Named commands that run between the `up` commands and the seed command |
| `supervise` | `startDelaySeconds` (2), `readyTimeoutSeconds` (180), `checkoutPollSeconds` (5; 0 turns the check off) |
| `implode` | See below |

A step has a unique `name`, a shell command `run`, an optional `dir` (relative to the worktree), `env`, `unlessEnv` (skip the step when every listed variable has that value) and `show` (a regular expression: only matching output lines are printed; `--verbose` and failures print everything).

Every command runs after a `+ <command>` line on standard error: the install, `up`, step and seed commands, a `container.build`, and the container engine calls of `up`, `down` and the stop before `watch`. The values of the `-e NAME=value` arguments of the engine are printed as `***`. A skipped step prints no command line.

### `variant.implode`

| Option | Meaning |
| --- | --- |
| `preRm` | Directory names removed below each instance directory (below the root when there are no instances) |
| `restore` | Base names of tracked files whose local changes are discarded, after the report |
| `untracked` | Glob patterns of untracked files to delete; `{{slug}}` is replaced; tracked files stay |
| `requireMerged` | `false` skips the merge gate (default `true`) |
| `maxDiffLines` | The report holds the full `git diff` up to this many lines (default 200) |

`implode` refuses `main`. Unless `force` is given it refuses work that is not an ancestor of `origin/<baseBranch>` (or `<baseBranch>` without a remote branch) and changes nothing. After the gate it stops the runtime, drops the database target, deletes the storage, clears the state, removes the `untracked` files and `preRm` directories, prints `git status` and `git diff`, restores the listed files and removes the worktree. The branch stays.

### Instances

| Option | Meaning |
| --- | --- |
| `kind`, `dir` | `vite` or `nestjs`, and the directory below the worktree |
| `up`, `watch` | `up` runs while provisioning; `watch` is the process `variant watch` supervises |
| `open` | URL template of the instance |
| `dotenv` | Env file in `dir`, copied for a variant and amended with `env` and `envAlways` |
| `dotenvSource` | Env file copied instead of the primary worktree's (`VARIANT_ENV_SOURCE` wins) |
| `env` | Values for the instance's commands, and for the dotenv copy when it is created |
| `envAlways` | Like `env`, and written into the dotenv copy again on every run |
| `install` | Command that runs in `dir` when `dir` has no `node_modules` |
| `ready` | URL path that answers with a success status when the instance serves |
| `container` | How `up` runs the instance |

`container` takes `image`, `dockerfile` (relative to the worktree, built with the worktree as context into `<image>:v-<slug>`), `build` (a command that runs in `dir` first), `static` (a directory served by nginx), `port` (inside the container; 80 for a static site), `proxy` (`{ path, to }` forwards requests below `path` to the container of instance `to`, WebSocket upgrades included), `volumes` and `env`.

`VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL` and `VARIANT_<KEY>_PID` override the runtime state of instance `<KEY>`.

## Runtime

`up` and `watch` prepare a variant the same way: ensure the worktree, assign a port to every instance (`VARIANT_<KEY>_PORT`, then `variants.local.yaml`, then a free unreserved port), prepare the database target and provision. `up` recreates the target; `watch` keeps it. Neither touches the target of `main`.

Only one runtime exists per slug: `watch` removes the containers of the variant, `up` stops its recorded processes. After starting, the commands record `runtime` in the `variants.local.yaml` of the variant's worktree and, attached, wait for every `ready` path and open the URL of each instance with an `open` template.

An attached `watch` ends with exit status 130 on SIGINT or SIGTERM, 1 when one instance ends or the worktree disappears, and 0 only when detached. The CLI sets the process exit code from it.

:::
