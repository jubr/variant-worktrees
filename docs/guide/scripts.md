# Replacing shell scripts

::: v-pre

Projects that drive their test-environment variants with shell scripts (`variant:up`, `variant:watch`,
`variant:down`, `variant:list`, `variant:implode`) can move every one of them into `variants.yaml` and the
`variant` CLI. Project-specific choices (directories to delete, lockfiles to restore, the base branch, ports,
readiness paths, migration steps) are options, not code.

## Commands

| Script or task          | This project                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `variant:up`            | `variant up` — instances as containers on a fresh database                              |
| `variant:watch`         | `variant watch` — instances as supervised host processes; `--detach` returns at once    |
| `variant:down`          | `variant down` — stop what runs, keep data (works for `main`)                           |
| `variant:list`          | `variant list`; `variant list --table` prints the old table                             |
| `variant:implode`       | `variant implode`; `--force` replaces `VARIANT_FORCE=1`                                 |
| `destroy`               | removed; `implode` replaces it and also stops runtimes and removes the worktree         |
| `CLI_VERBOSE` (`task -v`) | `--verbose` on any command                                                            |

| Environment switch                                      | This project                                   |
| ------------------------------------------------------- | ---------------------------------------------- |
| `CONTAINER_ENGINE`                                      | still wins over `variant.containerEngine`      |
| `VARIANT_OPEN=0`                                        | still wins over `variant.open`                 |
| `VARIANT_ENV_SOURCE`                                    | still wins over an instance's `dotenvSource`   |
| `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `_PID`       | override the runtime state of the instance `<KEY>` |

## Where each hardcoded choice went

| Hardcoded in the scripts                         | Option                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `*/dist` removed on implode                      | `variant.implode.preRm`                                         |
| `package-lock.json`, `bun.lock` restored         | `variant.implode.restore`                                       |
| recordings such as `pr*-demo.webm` removed       | `variant.implode.untracked`                                     |
| merge gate against `origin/main`                 | `variant.baseBranch`, `variant.implode.requireMerged`          |
| 200-line diff cut-off                            | `variant.implode.maxDiffLines`                                  |
| `main`, `feat/`, `fix/`                          | `variant.baseBranch`, `variant.branchPrefixes`                  |
| reserved ports 3000, 4200, 5432                  | `variant.reservedPorts`                                         |
| `docker`, then `podman`                          | `variant.containerEngine`                                       |
| opening the browser                              | `variant.open`                                                  |
| `.storage`, `STORAGE_ROOT`                       | `variant.storage`                                               |
| migrate, role, seed, company and demo commands   | `variant.steps`                                                 |
| `sleep 2`, 180 s readiness, 5 s checkout poll    | `variant.supervise`                                             |
| `/api/health/live`                               | instance `ready`                                                |
| `server/.env` copy and its patched values        | instance `dotenv`, `dotenvSource`, `env`, `envAlways`           |
| `bun install` when `node_modules` is missing     | instance `install`                                              |
| image, Dockerfile, nginx proxy, volumes          | instance `container`                                            |
| `JWT_SECRET` default `variant-local-<slug>`      | `env: { JWT_SECRET: "{{JWT_SECRET:-variant-local-{{slug}}}}" }` |

## Instances are a record

`variant.instances` is keyed by instance name. The key is the name in runtime state, in templates
(`{{port.be}}`), in container names (`v-<key>-<slug>`) and in environment variables. The list form with a `name`
field is no longer accepted.

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

The environment segment of a key is uppercase with every non-alphanumeric character replaced by `_`, so
`VARIANT_BE_PORT=62099` pins the port of `be`. Two keys with the same segment are rejected. Instances start in
the listed order. List a container that another one proxies to first: a static site resolves its proxy target by
name when it starts.

## Templates

Values of `env`, `envAlways`, `container.env`, `container.volumes` and `open` are rendered in two passes.

1. Variant placeholders: `{{slug}}`, `{{schema}}` (the database schema or file), `{{storage}}`,
   `{{worktree}}`, `{{url}}`, `{{port}}` and `{{port.<instance>}}`.
2. Environment templates: `{{NAME}}` reads the environment and fails when it is unset, `{{NAME:-default}}`
   falls back to `default`. The placeholders of the first pass work inside a default, which is how
   `{{JWT_SECRET:-variant-local-{{slug}}}}` works.

Every command also sees `VARIANT_SLUG`, `VARIANT_TARGET`, the database settings (`POSTGRES_*`, `MYSQL_*` or
`SQLITE_DATABASE`), the storage variable, and the port and URL of every instance as `VARIANT_<KEY>_PORT` and
`VARIANT_<KEY>_URL`.

## Options

### `variant`

| Option                | Meaning                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `baseBranch`          | New variant branches start here; a variant must be merged here before `implode` (default `main`) |
| `branchPrefixes`      | The first prefixes a new branch; all are dropped to derive a slug (default `feat/`, `fix/`) |
| `containerEngine`     | `docker` or `podman`; `CONTAINER_ENGINE` wins; absent: `docker` if installed, else `podman` |
| `open`                | `false` prints URLs without opening a browser; `VARIANT_OPEN=0` wins                      |
| `reservedPorts`       | Ports that are never picked for an instance (default 3000, 4200, 5432)                   |
| `storage`             | `{ dir, env }`: a per-variant directory (default `.storage`) and the variable that carries it (default `STORAGE_ROOT`) |
| `steps`               | Named commands that run between the `up` commands and the seed command                    |
| `supervise`           | `startDelaySeconds` (2), `readyTimeoutSeconds` (180), `checkoutPollSeconds` (5; 0 turns the check off) |
| `implode`             | See below                                                                                 |

A step has a unique `name`, a shell command `run`, an optional `dir` (relative to the worktree), `env`,
`unlessEnv` (skip the step when every listed variable has that value) and `show` (a regular expression: only
matching output lines are printed; `--verbose` and failures print everything).

### `variant.implode`

| Option          | Meaning                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `preRm`         | Directory names removed below each instance directory (below the root when there are no instances) |
| `restore`       | Base names of tracked files whose local changes are discarded, after the report               |
| `untracked`     | Glob patterns of untracked files to delete; `{{slug}}` is replaced; tracked files stay        |
| `requireMerged` | `false` skips the merge gate (default `true`)                                                 |
| `maxDiffLines`  | The report holds the full `git diff` up to this many lines (default 200)                      |

`implode` refuses `main`. Unless `force` is given it refuses work that is not an ancestor of
`origin/<baseBranch>` (or `<baseBranch>` without a remote branch) and changes nothing. After the gate it stops
the runtime, drops the database target, deletes the storage, clears the state, removes the `untracked` files and
`preRm` directories, prints `git status` and `git diff`, restores the lockfiles and removes the worktree. The
branch stays.

### Instances

| Option         | Meaning                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `kind`, `dir`  | `vite` or `nestjs`, and the directory below the worktree                                          |
| `up`, `watch`  | `up` runs while provisioning; `watch` is the process `variant watch` supervises                   |
| `open`         | URL template of the instance                                                                      |
| `dotenv`       | Env file in `dir`, copied for a variant and amended with `env` and `envAlways`                    |
| `dotenvSource` | Env file copied instead of the primary worktree's (`VARIANT_ENV_SOURCE` wins)                     |
| `env`          | Values for the instance's commands, and for the dotenv copy when it is created                    |
| `envAlways`    | Like `env`, and written into the dotenv copy again on every run                                   |
| `install`      | Command that runs in `dir` when `dir` has no `node_modules`                                       |
| `ready`        | URL path that answers with a success status when the instance serves                              |
| `container`    | How `up` runs the instance                                                                        |

`container` takes `image`, `dockerfile` (relative to the worktree, built with the worktree as context into
`<image>:v-<slug>`), `build` (a command that runs in `dir` first), `static` (a directory served by nginx),
`port` (inside the container; 80 for a static site), `proxy` (`{ path, to }` forwards requests below `path` to
the container of instance `to`, WebSocket upgrades included), `volumes` and `env`.

## Runtime

`up` and `watch` prepare a variant the same way: ensure the worktree, assign a port to every instance
(`VARIANT_<KEY>_PORT`, then `variants.local.yaml`, then a free unreserved port), prepare the database target
and provision. `up` recreates the target; `watch` keeps it. Neither touches the target of `main`.

Only one runtime exists per slug: `watch` removes the containers of the variant, `up` stops its recorded
processes. After starting, the commands record `runtime` in the `variants.local.yaml` of the variant's worktree
and, attached, wait for every `ready` path and open the URL of each instance with an `open` template.

An attached `watch` ends with exit status 130 on SIGINT or SIGTERM, 1 when one instance ends or the worktree
disappears, and 0 only when detached. The CLI sets the process exit code from it.

:::
