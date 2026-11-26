# Configuration

`variants.yaml` at the main checkout in the workspace holds the options of a project.
Database settings are autodetected from the environment (see [Environment through Mise](./runtime#environment-through-mise)): Postgres, MySQL, MariaDB (`MARIADB_*` or a `mariadb://` URL, dialect `mysql`) and SQLite.
Explicit [`db`](#database-options) values override those.
`variant init` writes the autodetected values into a first `variants.yaml`.
What happens while watches run is in [Runtime](./runtime), and the editor side is in [Extension](/vscode/extension).

::: v-pre

## Variant options

Listed here are all possible (sub-)keys of `variant` in alphabetical order.
The options of the chat renamer are on [their own page](/chat-renamer/configuration), and the [`db`](#database-options) section follows.

### `variant.abbr`

A short label of the project for hostnames, lowercase letters and digits optionally separated by `-`.
Absent: the first letter or digit of each word of the main checkout's directory name (`variant-worktrees` is `vw`, `OtherTitleCase` is `otc`, `moreStuff` is `ms`, `lower_example` is `le`, no letters at all `app`).
It is the `${abbr}` of [Templates](#templates).

<hr class="option-sep">

### `variant.baseBranch`

New variant branches start here; a variant must be merged here before `implode` (default `main`).

<hr class="option-sep">

### `variant.branchPrefixes`

The first prefixes a new branch; all are dropped to derive a slug (default `feat/`, `fix/`).

<hr class="option-sep">

### `variant.containerEngine`

`docker` or `podman`; `CONTAINER_ENGINE` wins; absent: `docker` if installed, else `podman`.

<hr class="option-sep">

### `variant.implode`

Options of [`variant implode`](./commands#variant-implode), one heading each below.

`implode` refuses `main`.
Unless `force` is given it refuses work that is not an ancestor of `origin/<baseBranch>` (or `<baseBranch>` without a remote branch) and changes nothing.
After the gate it stops the runtime, drops the database target, deletes the storage, clears the state, removes the [`variant.implode.preRm`](#variant-implode-prerm) matches, prints a report of what the worktree still holds, discards the changes of the [`variant.implode.discard`](#variant-implode-discard) files, removes the worktree, and then removes the local branch.
`--branch-rm=no` keeps that branch. `--branch-rm=yes` is the default.
The report is a dark-yellow `+ <command>` trace around plain `git status --porcelain`, `git diff --stat`, and one `git diff -U1 <path>` per changed file (the patch starts at the `+++` line).
Git's own color is off.

<hr class="option-sep">

### `variant.implode.discard`

Base names of tracked files whose local changes are discarded, after the report.

<hr class="option-sep">

### `variant.implode.maxDiffLines`

How many kept lines of the filtered `git diff -U1` patches the report includes (default 200).
The porcelain status, the stat and the trace lines are not counted.
Over the limit every per-file patch is omitted.

<hr class="option-sep">

### `variant.implode.preRm`

Glob patterns of files and directories to delete, matched from the project directory and from each watch directory; `${slug}` is replaced.
A match that is, or contains, a tracked file stays. Symlinks are not followed.
Removed before the report.

<hr class="option-sep">

### `variant.implode.requireMerged`

`false` skips the merge gate (default `true`).

<hr class="option-sep">

### `variant.main`

The main checkout the worktrees are made from, relative to `variants.yaml`.
Default: the directory a parent `AGENTS.md` symlink points into, else the git checkout.

<hr class="option-sep">

### `variant.mise`

Where Mise is found. The only option is [`variant.mise.binPath`](#variant-mise-binpath).

<hr class="option-sep">

### `variant.mise.binPath`

The Mise executable, when `mise` is not on `PATH`; the editor setting [`variant.mise.binPath`](#variant-mise-binpath) wins.
The full lookup order is in [Runtime](./runtime#environment-through-mise).

<hr class="option-sep">

### `variant.open`

`false` does not open a browser; `VARIANT_OPEN=0` wins.

<hr class="option-sep">

### `variant.ports`

The ports watches and `variant ui` get.
The only option is [`variant.ports.range`](#variant-ports-range).

<hr class="option-sep">

### `variant.ports.range`

`LOW-HIGH` (1024 to 65535, default `42000-42999`): the free ports of watches and of `variant ui` are picked from it.
An explicit `VARIANT_<KEY>_PORT` or `runtime.watches.<key>.port` may lie anywhere.

<hr class="option-sep">

### `variant.prefix`

Starts every name derived from a slug, such as worktree directories (default `_v-`).

<hr class="option-sep">

### `variant.root`

Directory that holds the worktrees, relative to `variants.yaml`.
Default: the directory that holds a parent `AGENTS.md` symlink pointing into [`variant.main`](#variant-main) (so `variant watch -s foo` creates `<parent>/_v-foo`), otherwise [`variant.main`](#variant-main) itself (`./_v-foo`).
A worktree directory inside [`variant.main`](#variant-main) gets `_v-*` added to an existing `.gitignore` when missing; a `.gitignore` is never created.

<hr class="option-sep">

### `variant.steps`

A map keyed by step name, merged on top of the builtin steps.
The builtin steps `create`, `provision`, `seed`, `watch`, `down`, `deprovision` and `implode` stay in that order; an entry of the same name overlays that step.
A custom step has [`cmd`](#variant-steps-name-cmd) and exactly one of [`runBefore`](#variant-steps-name-runbefore) and [`runAfter`](#variant-steps-name-runafter), naming a builtin step or another step.
A builtin overlay may omit `cmd`.
Setting `VARIANT_STEP_<NAME>=no` skips the step and prints a `Skipping step` line.
The flow is in the [Overview](./overview#flow-of-steps).

<hr class="option-sep">

### `variant.steps.<name>`

One step. A name matches `[A-Za-z0-9_-]{2,20}`. The options are described below.

<hr class="option-sep">

### `variant.steps.<name>.cmd`

The shell command of the step. Required for a custom step, optional for a builtin overlay.

<hr class="option-sep">

### `variant.steps.<name>.dir`

The directory the command runs in, relative to the worktree (default: the worktree root).

<hr class="option-sep">

### `variant.steps.<name>.env`

Templated values that win over everything else the command sees.
`${NAME}` and `${NAME:-default}` read the environment, see [Templates](#templates).

<hr class="option-sep">

### `variant.steps.<name>.filterLinesRegex`

A regular expression: only matching output lines are printed.
`--verbose` and failures print everything.

<hr class="option-sep">

### `variant.steps.<name>.runAfter`

The builtin step or custom step this step runs after.
A custom step has exactly one of this and [`variant.steps.<name>.runBefore`](#variant-steps-name-runbefore).

<hr class="option-sep">

### `variant.steps.<name>.runBefore`

The builtin step or custom step this step runs before.
A custom step has exactly one of this and [`variant.steps.<name>.runAfter`](#variant-steps-name-runafter).

<hr class="option-sep">

### `variant.storage`

A per-variant directory and the variable that carries it: [`variant.storage.dir`](#variant-storage-dir) and [`variant.storage.envVarName`](#variant-storage-envvarname).

<hr class="option-sep">

### `variant.storage.dir`

The per-variant directory, relative to the worktree (default `.storage`).

<hr class="option-sep">

### `variant.storage.envVarName`

The variable that carries the directory to commands (default `STORAGE_ROOT`).

<hr class="option-sep">

### `variant.supervise`

The timing of `up` and `watch`: [`startDelaySeconds`](#variant-supervise-startdelayseconds), [`readyTimeoutSeconds`](#variant-supervise-readytimeoutseconds) and [`checkoutPollSeconds`](#variant-supervise-checkoutpollseconds).

<hr class="option-sep">

### `variant.supervise.checkoutPollSeconds`

How often a `watch`, attached or detached, checks that its worktree directory still exists, in seconds (default 5; 0 turns the check off).
When the directory is gone the watch stops its processes and implodes the variant, see [Worktree removed](./runtime#worktree-removed).

<hr class="option-sep">

### `variant.supervise.readyTimeoutSeconds`

How long `up` and `watch` wait, in seconds, for the watches that set [`ready`](#variant-watches-key-ready) to answer with status 200 (default 180).
After that the watches keep running and a warning is printed.

<hr class="option-sep">

### `variant.supervise.startDelaySeconds`

The wait between starting two watches, in seconds (default 2).

<hr class="option-sep">

### `variant.ui`

Settings of the `variant ui` server. The only option is [`variant.ui.port`](#variant-ui-port).

<hr class="option-sep">

### `variant.ui.port`

The port of the `variant ui` server.
`VARIANT_UI_PORT` wins; absent: a free port of [`variant.ports.range`](#variant-ports-range).

<hr class="option-sep">

### `variant.watches`

The watches of the project, keyed by watch name. Watches start in the listed order.
List a container that another one reaches by name first: an nginx in a Dockerfile resolves the name of its proxy target when it starts.
Without [`variant.watches`](#variant-watches), applications are detected: see [When watches are omitted](./runtime#when-watches-are-omitted).

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

<hr class="option-sep">

### `variant.watches.<key>`

One watch.
The key is the name in runtime state, in templates (`${be.port}`), in container names (`v-<key>-<slug>`) and in environment variables.

The environment segment of a key is uppercase with every non-alphanumeric character replaced by `_`, so `VARIANT_BE_PORT=62099` pins the port of `be`.
Two keys with the same segment are rejected.
The key `variant-ui` is reserved for the server of `variant ui`, and so is every key whose segment is `UI` (such as `ui`), because `VARIANT_UI_PORT` is the server's port variable; defining a watch with one fails validation.
The options of a watch are described below.

<hr class="option-sep">

### `variant.watches.<key>.container`

How `up` runs the watch, as a container: [`dockerfile`](#variant-watches-key-container-dockerfile) and [`internalPort`](#variant-watches-key-container-internalport).
The Dockerfile does the rest: build the app, serve it, and reach other containers by name (`v-<key>-<slug>` on the network `v-net-<slug>`); `example/fe/Dockerfile` builds a Vite app and serves it with `nginx:alpine`, proxying `/api/` to the `be` container.
The container receives the `VARIANT_*` and database variables only: not [`env.overrides`](#variant-watches-key-env-overrides), and neither `SQLITE_DATABASE` nor the storage variable, which are host paths.

<hr class="option-sep">

### `variant.watches.<key>.container.dockerfile`

Relative to the worktree, built with the worktree as context into `v-<key>:v-<slug>`.
Required when `container` is set.

<hr class="option-sep">

### `variant.watches.<key>.container.internalPort`

The port inside the container (80 when absent).

<hr class="option-sep">

### `variant.watches.<key>.dir`

The directory below the worktree. The key of the watch when absent.

<hr class="option-sep">

### `variant.watches.<key>.env`

The env file of the watch: [`sourceFile`](#variant-watches-key-env-sourcefile) and [`overrides`](#variant-watches-key-env-overrides).

<hr class="option-sep">

### `variant.watches.<key>.env.overrides`

Templated values for the watch's commands, written into the copy of the env file when it is created, together with the storage variable.
An existing copy is left alone.

<hr class="option-sep">

### `variant.watches.<key>.env.sourceFile`

An env file in [`dir`](#variant-watches-key-dir), copied once for a variant (from the primary worktree's file, its `.example`, or `VARIANT_ENV_SOURCE`).

<hr class="option-sep">

### `variant.watches.<key>.install`

Command that runs in `dir` when `dir` has no `node_modules`.

<hr class="option-sep">

### `variant.watches.<key>.kind`

`vite` or `nestjs`. A label; autodetection sets it. Optional.

<hr class="option-sep">

### `variant.watches.<key>.output`

How the output of the watch is captured: [`mode`](#variant-watches-key-output-mode).

<hr class="option-sep">

### `variant.watches.<key>.output.mode`

`tty` or `no-tty`.
`tty` starts the process on a pseudo-terminal, so it prints color into `.cache/variant/watch.log`.
Otherwise the watch runs with pipes and a warning.
A line that contains an ANSI escape gets a reset before the newline.
The log starts with one line `[watch] {args} mode=tty # set to 'no-tty' likely suppresses ansi escape sequences`, where `{args}` is the invocation flags such as `--detach`.
`no-tty` keeps pipes, and stdout and stderr stay separate.
Clear-screen sequences (erase display, cursor home, terminal reset) are removed from every line, in every mode, so a pager or `tail -f` of the log is not wiped; color and other sequences stay.
Absent: the editor uses `tty` when an enabled extension's description contains both `log` and `ansi`, and `no-tty` otherwise.
The CLI does not see extensions, so an omitted mode stays `no-tty` there.

<hr class="option-sep">

### `variant.watches.<key>.ready`

A URL path that starts with `/`. A probe counts only on status 200.
The first probe and the first 200 log the full URL.

<hr class="option-sep">

### `variant.watches.<key>.up`

The command that runs while provisioning.

<hr class="option-sep">

### `variant.watches.<key>.url`

URL template of the watch.

<hr class="option-sep">

### `variant.watches.<key>.watch`

The process `variant watch` supervises.

## Chat Renamer options

All `chatRenamer.*` options are valid in the Variant Worktrees too and are described at [Chat Renamer configuration](/chat-renamer/configuration).

## Database options

Settings are autodetected from `mise.local.toml`, then the environment, and explicit values override them.
`variant init` writes the detected values, with secrets as `${NAME}` references.
A `db` setting has no variant, so a variant placeholder in one is an error: see [Templates](#templates).
Every key has a heading of its own, in alphabetical order.

### `db.database`

The database name for PostgreSQL and MySQL.
Autodetected from `POSTGRES_DB`, `MYSQL_DATABASE` or `MARIADB_DATABASE`.

For SQLite it is the full file name, absolute or relative, not a database name.
`{slug}` stands for the slug of the variant, and a relative name is resolved in the worktree of the variant (the main checkout for `main`).
Absent: `.cache/variants/{slug}.sqlite`.
Autodetected from `SQLITE_DATABASE`, `SQLITE_PATH` or a `sqlite:` `DATABASE_URL`.
Examples for each dialect, with the file layout, are on the [Database](./database) page.

<hr class="option-sep">

### `db.dialect`

`postgres`, `mysql` or `sqlite`. MariaDB is `mysql`. Absent: autodetected.
An explicit `sqlite` reads no environment at all.

<hr class="option-sep">

### `db.host`

The host of the database server.
Required unless [`db.url`](#db-url) is set or the dialect is `sqlite`.
Autodetected from `POSTGRES_HOST`, `MYSQL_HOST` or `MARIADB_HOST`.

<hr class="option-sep">

### `db.multi`

One PostgreSQL schema per tenant.
Exactly one of [`db.multi.tenants`](#db-multi-tenants) and [`db.multi.tenantsCmd`](#db-multi-tenantscmd).
The reported target stays `v_<slug>`.
A step passes the list and the prefix through its `env` as `${multi.tenants}` and `${multi.schemaPrefix}`.
[`db.multi`](#db-multi) on `mysql` or `sqlite` is refused. The runtime copy of `db` omits `multi`.
A worked example is in [Custom multi-tenancy steps](#custom-multi-tenancy-steps).

```yaml
db:
  dialect: postgres
  host: 127.0.0.1
  multi:
    schemaPrefix: v_${slug}-
    tenantsCmd: sed -rn ${worktree}/server/.env -e 's/^WITCHES=(.*)$/\1/p'
    # tenants: east,west
```

<hr class="option-sep">

### `db.multi.schemaPrefix`

Defaults to `v_${slug}-` and is otherwise any non-empty template, so slug `demo` and tenant `east` is the schema `v_demo-east`.

<hr class="option-sep">

### `db.multi.tenants`

The tenants as text such as `east,west`.
Not together with [`db.multi.tenantsCmd`](#db-multi-tenantscmd).

<hr class="option-sep">

### `db.multi.tenantsCmd`

A shell command, evaluated lazily, whose output is the tenant list.
Not together with [`db.multi.tenants`](#db-multi-tenants).

<hr class="option-sep">

### `db.password`

The password.
It is `***` in every printed result, and `variant init` writes a `${NAME}` reference instead of the value.
Autodetected from `POSTGRES_PASSWORD`, `MYSQL_PASSWORD` or `MARIADB_PASSWORD`.

<hr class="option-sep">

### `db.port`

A positive integer, a string of digits or one `${NAME}` (`${POSTGRES_PORT}`); after loading it is a positive integer.
Absent: 5432 for Postgres and 3306 for MySQL.
Autodetected from `POSTGRES_PORT`, `MYSQL_PORT` or `MARIADB_PORT`.

<hr class="option-sep">

### `db.schema`

The database schema of the main variant. Autodetected from `POSTGRES_SCHEMA` or `MYSQL_SCHEMA`.

<hr class="option-sep">

### `db.ssl`

`true` or `false`: whether the connection uses SSL. Autodetected from `POSTGRES_SSL`.

<hr class="option-sep">

### `db.url`

A connection URL (`postgres://`, `mysql://`, `mariadb://`).
When set it replaces [`db.host`](#db-host), [`db.port`](#db-port), [`db.user`](#db-user), [`db.password`](#db-password) and [`db.database`](#db-database).
Autodetected from `DATABASE_URL`.

<hr class="option-sep">

### `db.user`

The database user. Autodetected from `POSTGRES_USER`, `MYSQL_USER` or `MARIADB_USER`.

## Custom Steps

A custom step has exactly one of [`runBefore`](#variant-steps-name-runbefore) or [`runAfter`](#variant-steps-name-runafter).
They name a builtin step (`create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`) or another custom step.
The flow of the builtin steps is in the [Overview](./overview#flow-of-steps).

```yaml
variant:
  steps:
    migrations: # unique, only [A-Za-z0-9_-]{2,20}, VARIANT_STEP_MIGRATIONS=no skips
      cmd: bun run migrate # shell commands
      dir: be # relative to the worktree; default: the worktree root
      env: # templated values; win over everything else the command sees
        JWT_SECRET: '${JWT_SECRET:-variant-local-${slug}}' # ${NAME} and ${NAME:-default} read the environment
      filterLinesRegex: '^Migration ' # print only the output lines that match; --verbose and failures print everything
      runAfter: seed
      #runBefore: watch
```

Several steps with the same `runBefore` or the same `runAfter` run in the order in which they are written in `variants.yaml`.

With `runAfter: watch` on `custom1`, [`variant watch`](./commands#variant-watch) runs create, provision, seed, watch, custom1:

```yaml
variant:
  steps:
    custom1:
      cmd: bun run notify
      runAfter: watch
```

## Custom multi-tenancy steps

With [`db.multi`](#db-multi) set, one provision run creates every schema under [`db.multi.schemaPrefix`](#db-multi-schemaprefix), and the list of tenants comes from [`db.multi.tenants`](#db-multi-tenants) or [`db.multi.tenantsCmd`](#db-multi-tenantscmd).

```yaml
db:
  dialect: postgres
  host: 127.0.0.1
  multi:
    schemaPrefix: v_${slug}-
    #tenants: east,west
    tenantsCmd: sed -rn ${worktree}/server/.env -e 's/^WITCHES=(.*)$/\1/p' # lazy evaluation

variant:
  steps:
    provision: # one run; creates every schema and any users/roles it may need
      cmd: bun run db:provision:witches
      dir: server
      env: &prov-env
        MULTI_TENANT_LIST: ${multi.tenants} # populated by multi.tenantsCmd
        MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix} # cmd creates 'v_${slug}-east' + west
    seed: # one run; seeds every tenant schema
      cmd: bun run db:seed:witches
      dir: server
      env: *prov-env
    migrations:
      cmd: bun run migrate
      dir: server
      env: *prov-env
      runAfter: seed
    deprovision: # one run; replaces the builtin schema drop
      cmd: bun run db:deprovision:witches
      dir: server
      env: *prov-env
```

So with `slug=demo` and `.env` containing `WITCHES=east,west`, `watch` runs `db:provision:witches` once with `MULTI_TENANT_LIST=east,west` and `MULTI_SCHEMA_PREFIX=v_demo-`, then `db:seed:witches` once with the same vars, then `migrations` once.
`deprovision` runs `db:deprovision:witches` once with the same vars and drops nothing itself.
The script removes `v_demo-east`, `v_demo-west`, a leftover `v_demo-north` and any role.

## Templates

Every string setting is templated, `db` included, with one syntax.
Values are expanded in two passes: first the variant placeholders, then the environment forms (`${NAME}` and `${NAME:-default}`).
The example values assume slug `demo`, abbreviation `vw`, a watch `be` on port 3001 and a watch on port 4200.

| Item                    | Meaning                                                                                                                                                   | Example use                                | Example value                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| `${slug}`               | the slug of the variant                                                                                                                                   | `v_${slug}-`                               | `v_demo-`                         |
| `${schema}`             | the database schema, or the SQLite file                                                                                                                   |                                            | `v_demo`                          |
| `${storage}`            | the storage directory of the variant, see [`variant.storage.dir`](#variant-storage-dir)                                                                   |                                            | `/home/me/vw/_v-demo/.storage`    |
| `${worktree}`           | the absolute, normalized path of the worktree                                                                                                             | `${worktree}/server/.env`                  | `/home/me/vw/_v-demo/server/.env` |
| `${url}`                | the URL of the watch                                                                                                                                      |                                            | `http://demo.vw.localhost:4200`   |
| `${port}`               | the port of the watch                                                                                                                                     | `http://${slug}.${abbr}.localhost:${port}` | `4200`                            |
| `${<watch>.port}`       | the port of another watch, by its key                                                                                                                     | `${be.port}`                               | `3001`                            |
| `${abbr}`               | the project abbreviation, see [`variant.abbr`](#variant-abbr); the default `url` of a detected Vite watch is `http://${slug}.${abbr}.localhost:${port}`   | `http://${slug}.${abbr}.localhost:${port}` | `http://demo.vw.localhost:4200`   |
| `${multi.tenants}`      | the tenant list of [`db.multi`](#db-multi) joined by commas; empty without [`db.multi`](#db-multi). It runs `tenantsCmd` the first time a step expands it |                                            | `east,west`                       |
| `${multi.schemaPrefix}` | [`db.multi.schemaPrefix`](#db-multi-schemaprefix) with `${slug}` filled in; empty without [`db.multi`](#db-multi). It does not run `tenantsCmd`           |                                            | `v_demo-`                         |
| `${NAME}`               | the environment (Mise, then the process); fails when unset                                                                                                | `${POSTGRES_PORT}`                         | `5432`                            |
| `${NAME:-default}`      | the same, falling back to `default`. The placeholders of the first pass work inside a default                                                             | `${JWT_SECRET:-variant-local-${slug}}`     | `variant-local-demo`              |
| `$${`                   | a literal `${`, for a shell command that expands its own variable                                                                                         | `echo $${HOME}`                            | `echo ${HOME}`                    |

A `db` setting has no variant, so a variant placeholder there is an error; [`db.port`](#db-port) may be `${POSTGRES_PORT}`.
`variant init` writes secrets as `${NAME}` references.
A `${` that was already in a value is not touched: write `$${` where a shell must see it, since `${NAME}` reads the environment.

## Unknown keys and migration

A key `variants.yaml` does not know is a warning, not an error: the command prints `<file>: unknown key <path>` on standard error, one line per key, and runs without it.
A value of the wrong type or a missing required value is still an error.

When the working directory is inside a variant worktree that contains `variants.yaml` or `variants.yml`, that file is the configuration.
An ancestor file and an `AGENTS.md` symlink do not replace it.

The `variant` CLI and the VS Code extension rewrite a `variants.yaml` written for an earlier version in place, keeping comments and layout, when it is tracked by git and has no uncommitted changes; review the change with `git diff` and revert it with `git checkout -- variants.yaml`.
A `variants.yaml` that git does not track is rewritten too, after its old text is saved as `variants.yaml~` (nothing happens when that file exists); a tracked file with uncommitted changes is left alone.
Nothing is rewritten when `CI` is set (other than empty, `0` or `false`) or `VARIANT_MIGRATE=0`; the notice then names the reason.
The library, the MCP server and `variant ui` never write.

The same migration puts the schema header on top of a `variants.yaml` that has none: `# yaml-language-server: $schema=https://github.com/jubr/variant-worktrees/raw/refs/heads/main/packages/variant-config/variants.yaml.schema.json`, so editors offer completion and validation.
A schema line you wrote yourself stays.
When the header cannot be added (a tracked file with uncommitted changes, `CI`, `VARIANT_MIGRATE=0`) nothing is printed, because it is cosmetic.
`.cache/variant/state.yaml` and `runtime.yaml` have no schema line.

`db.filename` was renamed [`db.database`](#db-database), and the migration rewrites it: the notice is `<file>: db.filename is now db.database`, and a file that has both keeps [`db.database`](#db-database) and drops `db.filename`.
The value is kept as it was written.
A relative name now resolves in the worktree of the variant, where it resolved in the directory of `variants.yaml` before, so write an absolute path to keep a file where it is.
When there is no [`db.database`](#db-database) and the directory of `variants.yaml` holds `{slug}.db` files below its `.cache/variants` directory, the migration adds `db.database: <that directory>/{slug}.db`, so those databases stay in use; delete the line to move to `.cache/variants/{slug}.sqlite`.

:::
