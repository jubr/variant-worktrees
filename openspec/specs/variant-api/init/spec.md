# variant-api/init Specification

## Purpose

`variant init` bootstraps a project for Variant: it writes a `variants.yaml` from what autodetection finds, keeps the
worktree directories out of git and augments the mise configuration with the CLI, so a person starts from a working file instead of a
blank one.

## Requirements

### Requirement: Init command

The system SHALL provide the command `init` in `variant-api`, reachable as `variant init` and as the MCP tool
`variant_init`, which runs in-process and not through the editor socket. It SHALL take an optional string `prefix`
(default `_v-`), three booleans that default to true and turn one step off each when false (`file`: write
`variants.yaml`; `gitignore`: add the worktree pattern to `.gitignore`; `mise`: augment the mise configuration with the CLI), and a
boolean `force`. It SHALL act on the current directory (the workspace root for an editor) and SHALL return what each
step did: the path of the written file or `null`, whether `.gitignore` and the mise configuration changed, and the detected
values. A `prefix` that is empty or contains a path separator SHALL be refused before anything is written.

#### Scenario: Defaults

- **WHEN** a person runs `variant init` in a directory without `variants.yaml`
- **THEN** `variants.yaml` is written with `variant.prefix: _v-`, `.gitignore` gains `_v-*` and the mise
  configuration lists the CLI

#### Scenario: Custom prefix

- **WHEN** a person runs `variant init --prefix wt-`
- **THEN** the file has `variant.prefix: wt-` and `.gitignore` gains `wt-*`

#### Scenario: Invalid prefix

- **WHEN** a person runs `variant init --prefix a/b`
- **THEN** the command fails naming the prefix and writes nothing

#### Scenario: Skipping a step

- **WHEN** a person runs `variant init --gitignore=false --mise=false`
- **THEN** only `variants.yaml` is written, and each other step can be skipped the same way

### Requirement: Init writes autodetected values

`variant init` SHALL write into `variants.yaml` every value that autodetection resolves for the directory: the `db`
settings found in the Mise or process environment ([specs/tools/mise](../../tools/mise/spec.md)) (Postgres, MySQL and MariaDB, which are written as dialect
`mysql`, and SQLite), `variant.abbr`, `variant.prefix`, and one entry of `variant.watches` per detected application
with its `kind`, `watch` and, for Vite, `url` (in the `${...}` syntax); `dir` is written only when it differs from the key of the entry. When no
database is detected it SHALL write only `db.dialect: sqlite`. Machine-specific absolute paths (`variant.main`,
`variant.root`, the default SQLite file) SHALL NOT be written. The written file SHALL pass the same validation as any
`variants.yaml`, and loading it SHALL resolve to the same database and watches as the autodetected ones.

#### Scenario: Postgres from mise

- **WHEN** `mise.local.toml` defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and
  `POSTGRES_DB`
- **THEN** the file has `db.dialect`, `host`, `port`, `user` and `database`, and `password` as an environment
  reference

#### Scenario: MariaDB

- **WHEN** the environment defines `MARIADB_HOST` and `MARIADB_DATABASE`
- **THEN** the file has `db.dialect: mysql` with that host and database

#### Scenario: Nothing detected

- **WHEN** no database setting is detected
- **THEN** the file has `db: { dialect: sqlite }` and no `filename`

#### Scenario: Watches

- **WHEN** a Vite app in `fe` and a NestJS app in `be` exist
- **THEN** the file has watches `be` and `fe` with their `kind` and autodetected `watch`, `fe` has `url`, and neither
  has `dir`

#### Scenario: Directory differs from the key

- **WHEN** apps exist in `a/web` and `b/web`
- **THEN** the watches are `web` and `web-2` and each has its `dir`

#### Scenario: Round trip

- **WHEN** the written file is loaded
- **THEN** validation passes and the resolved database equals the autodetected one

### Requirement: Secrets stay in the environment

`variant init` SHALL NOT write a secret into `variants.yaml`. A `db.password` that autodetection read from an
environment variable (`POSTGRES_PASSWORD`, `MYSQL_PASSWORD`, `MARIADB_PASSWORD`) and a `db.url` read from
`DATABASE_URL` that carries a password SHALL be written as a reference `${NAME}` to that variable. Each reference
SHALL carry a comment on its line that names where the variable comes from: the path of the mise file that defines it
(its source as specified in [specs/tools/mise](../../tools/mise/spec.md), Variable sources), relative to the `variants.yaml`, such as `# from ../mise.local.toml`, or `# from the
environment` when no file is listed for it. Values that are not secrets SHALL be
written as they are.

#### Scenario: Password from mise

- **WHEN** `mise.local.toml` in the parent directory defines `POSTGRES_PASSWORD`
- **THEN** the file has the line `password: ${POSTGRES_PASSWORD} # from ../mise.local.toml` and no value of the
  password

#### Scenario: URL with credentials

- **WHEN** the environment has `DATABASE_URL=postgres://app:secret@localhost/app`
- **THEN** the file has `url: ${DATABASE_URL} # from the environment` and no part of `secret`

#### Scenario: URL without credentials

- **WHEN** `DATABASE_URL` is `postgres://localhost/app`
- **THEN** the file has that URL as it is

### Requirement: Script watches

`variant init` SHALL write a watch for each directory below the project (and the project directory itself) that has a
`package.json` with a watch-like script and that is not already a Vite or NestJS watch. The watch SHALL have no `kind`
and SHALL have `watch` set to the run command of the package manager followed by the first watch-like script of the
`package.json`, in file order: a script whose name is, or has as a segment separated by `:`, `-`, `_` or `.`, the word
`watch`. The package manager SHALL be `bun` with a `bun.lock` or `bun.lockb`, `pnpm` with a `pnpm-lock.yaml`, `yarn`
with a `yarn.lock` (in the directory or the project directory), else `npm`. The key SHALL follow the key rule of the
autodetected watches, with `app` for the project directory, which then also gets `dir: .`.

#### Scenario: Plain npm script

- **WHEN** `api/package.json` has the scripts `build` and `watch` and no lockfile exists
- **THEN** the file has the watch `api` with `watch: npm run watch` and no `kind`

#### Scenario: First watch-like script

- **WHEN** the scripts are `build`, `build:watch` and `watch`
- **THEN** the watch runs `npm run build:watch`

#### Scenario: Package manager from lockfile

- **WHEN** the directory has a `bun.lock` and a `watch` script
- **THEN** the watch is `bun run watch`

#### Scenario: Already a Vite watch

- **WHEN** a directory is detected as a Vite app and its `package.json` also has a `watch` script
- **THEN** the file has one watch for it, the Vite one

#### Scenario: Project directory

- **WHEN** the project directory's own `package.json` has a `watch` script and nothing else is detected
- **THEN** the file has the watch `app` with `dir: .` and `watch: npm run watch`

### Requirement: Alternatives in same-line comments

Every written setting whose accepted values are a closed set or whose form is constrained SHALL carry, in a comment
on the same line, the other accepted values or the rule: `dialect` lists the other dialects (`sqlite | mysql` after
`postgres`), `kind` lists the other kinds, `ssl` the other boolean, `abbr` and `prefix` state their constraint. The
current value SHALL NOT be repeated in the comment. A comment SHALL NOT change the YAML value.

#### Scenario: Dialect alternatives

- **WHEN** the file is written for a Postgres database
- **THEN** the line reads `dialect: postgres # sqlite | mysql`

#### Scenario: Kind alternatives

- **WHEN** a watch of kind `vite` is written
- **THEN** its line reads `kind: vite # nestjs`

#### Scenario: Comments are inert

- **WHEN** the written file is parsed
- **THEN** each commented value equals the value before its `#`

### Requirement: Worktree pattern in .gitignore

`variant init` SHALL append the line `<prefix>*` to the `.gitignore` of the directory, creating the file when absent.
It SHALL NOT add the line when `.gitignore` already has that exact line, and SHALL keep every existing line.

#### Scenario: Created

- **WHEN** no `.gitignore` exists
- **THEN** `.gitignore` is created holding `_v-*`

#### Scenario: Appended

- **WHEN** `.gitignore` holds `node_modules` without a trailing newline
- **THEN** it holds `node_modules` then `_v-*`, each on its own line

#### Scenario: Idempotent

- **WHEN** `.gitignore` already holds `_v-*`
- **THEN** it is not changed and the result says so

### Requirement: Mise step

The `mise` step of `variant init` SHALL augment the Mise configuration of the directory with the CLI as specified in
[specs/tools/mise](../../tools/mise/spec.md) (Augmenting the Mise configuration), report which file it changed or why it changed none, and SHALL NOT
stop the other steps when it fails or when Mise is not found.

#### Scenario: Step reported

- **WHEN** init runs with the defaults and `mise.toml` exists without the CLI
- **THEN** the result names `mise.toml` as changed

#### Scenario: Failure does not stop the others

- **WHEN** the chosen Mise file is not valid TOML
- **THEN** `variants.yaml` and `.gitignore` are still handled and the result names the Mise problem

### Requirement: Existing configuration

`variant init` SHALL refuse to write when a `variants.yaml` or `variants.yml` is found for the directory (the same
lookup as `loadConfig`), name that file, and change nothing, unless `force` is set or the file step is skipped. With
`force` it SHALL overwrite only the `variants.yaml` of the directory. The `.gitignore` and mise steps SHALL
still run when the file step is skipped.

#### Scenario: File exists

- **WHEN** `variants.yaml` exists and a person runs `variant init`
- **THEN** the command fails naming that file, the exit code is 1 and no file changed

#### Scenario: Forced

- **WHEN** `variants.yaml` exists and a person runs `variant init --force`
- **THEN** the file is replaced by the autodetected one

#### Scenario: Other steps only

- **WHEN** `variants.yaml` exists and a person runs `variant init --file=false`
- **THEN** `.gitignore` and the mise configuration are handled and `variants.yaml` is untouched

#### Scenario: Text output

- **WHEN** init succeeds
- **THEN** the text output names each step with what it did, and `--json` and `--yaml` render the returned result
