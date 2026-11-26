## MODIFIED Requirements

### Requirement: Multi-DB strategy

The system SHALL use schema-per-variant for PostgreSQL and MySQL, database-per-variant for SQLite, and report unsupported dialects.

#### Scenario: PostgreSQL uses schemas
- **WHEN** the connection is PostgreSQL
- **THEN** create and implode operate on `v_<slug>` schemas

#### Scenario: SQLite uses database files
- **WHEN** the connection is SQLite and `db.database` is not set
- **THEN** each variant is stored in `.cache/variants/<slug>.sqlite` below its own worktree

#### Scenario: SQLite uses the configured file
- **WHEN** the connection is SQLite and `db.database` is set
- **THEN** each variant is stored in the file that `db.database` resolves to for its slug, as described in "SQLite target of every slug"

#### Scenario: Unsupported dialect
- **WHEN** the dialect lacks supported schema or database isolation
- **THEN** the system returns an error explaining that table-prefix mode is not implemented

## ADDED Requirements

### Requirement: SQLite target of every slug

For SQLite the database target of a slug, the value in `state.yaml`, in `VARIANT_TARGET`, in `SQLITE_DATABASE`, in `${schema}` and in `runtime.db.database`, SHALL be the absolute path of one file, the same for `create`, `provision`, `watch`, `list`, `status` and `implode`. The path SHALL come from `db.database` with `{slug}` replaced by the slug. A relative path SHALL be resolved against the directory of the variant: the worktree `<variant.root>/<variant.prefix><slug>`, or the main checkout for the slug `main`; when the library runs without worktrees it SHALL be the directory of `variants.yaml`. An absolute path without `{slug}` SHALL be the file of `main`, and every other slug SHALL use `<slug>` plus the extension of that file in its directory. The slug `main` SHALL NOT get the target `public`, a PostgreSQL schema name, for SQLite. A command SHALL fail with an error that names the slug and `db.database` when the file of a slug other than `main` would be the file of `main`. `list` SHALL report the variants whose files exist: for an absolute `db.database` those in its directory, with the slug taken from the file name by the same rule, and for a relative one those in the directory of each known variant.

#### Scenario: Default target of a variant

- **WHEN** the connection is SQLite with no `db.database` and `create` runs for the slug `demo`
- **THEN** the target is `<variant.root>/_v-demo/.cache/variants/demo.sqlite`
- **AND** no file or directory is created by `create`

#### Scenario: Default target of main

- **WHEN** the connection is SQLite with no `db.database` and `create` runs for the slug `main`
- **THEN** the target is `<main checkout>/.cache/variants/main.sqlite`
- **AND** `state.yaml` records that path as `target` and `runtime.db.database`, not `public`

#### Scenario: Explicit relative file

- **WHEN** `db.database` is `abc.sqlite`
- **THEN** the target of `demo` is `<variant.root>/_v-demo/abc.sqlite` and the target of `main` is `<main checkout>/abc.sqlite`

#### Scenario: Create reports the configured file

- **WHEN** `variant config` prints `db.database` and `variant create -s demo` runs without further settings
- **THEN** the target of `demo` is that value with `{slug}` replaced by `demo`, resolved in the worktree of `demo`

#### Scenario: Absolute file without a template

- **WHEN** `db.database` is `/srv/db/app.sqlite`
- **THEN** the target of `main` is `/srv/db/app.sqlite` and the target of `demo` is `/srv/db/demo.sqlite`

#### Scenario: Absolute template

- **WHEN** `db.database` is `/srv/db/{slug}.sqlite`
- **THEN** the target of `demo` is `/srv/db/demo.sqlite` and the target of `main` is `/srv/db/main.sqlite`

#### Scenario: Slug collides with the main file

- **WHEN** `db.database` is `/srv/db/app.sqlite` and a command runs for the slug `app`
- **THEN** it fails with an error naming `app` and `/srv/db/app.sqlite`, and creates nothing

#### Scenario: Watches receive the target

- **WHEN** `watch` runs for the slug `main` in a SQLite project
- **THEN** `SQLITE_DATABASE` is the absolute path of the file of `main`

#### Scenario: Listing files in an absolute directory

- **WHEN** `db.database` is `/srv/db/{slug}.sqlite` and `demo.sqlite` and `other.sqlite` exist there
- **THEN** `list` reports the variants `demo` and `other`

#### Scenario: Listing files in worktrees

- **WHEN** `db.database` is the default, the worktrees `_v-demo` and `_v-other` exist and only `_v-demo/.cache/variants/demo.sqlite` exists
- **THEN** `list` reports both variants and only `demo` has a database file

#### Scenario: Earlier state of main

- **WHEN** the `state.yaml` of the main checkout records the dialect `sqlite` and the target `public`, and `provision` or `watch` runs for `main`
- **THEN** the recorded target becomes the resolved file of `main`

### Requirement: Variant records name their database

A variant record SHALL carry `database`, a string that says where the data of the variant is, without a secret. For SQLite it SHALL be `db.database` with `{slug}` replaced by the slug and nothing else changed: a relative file stays relative to the worktree of the variant, an absolute one stays absolute (the `target` is always the absolute path). For PostgreSQL and MySQL it SHALL be the connection as a URL with the scheme `postgres://` or `mysql://`, built from `db.url` or else from `db.user`, `db.host`, `db.port` and `db.database`; a password present in either SHALL be shown as `***`, and no other part of the URL SHALL be changed. The record SHALL keep `target` and `dialect`.

#### Scenario: SQLite record

- **WHEN** `create("demo")` runs for a SQLite project with no `db.database`
- **THEN** the record's `database` is `.cache/variants/demo.sqlite` and its `target` is the absolute path of that file in the worktree of `demo`

#### Scenario: Absolute SQLite record

- **WHEN** `db.database` is `/srv/db/{slug}.sqlite`
- **THEN** the record's `database` and `target` for `demo` are both `/srv/db/demo.sqlite`

#### Scenario: PostgreSQL record

- **WHEN** `db` has host `db.example`, port `5432`, user `app`, password `secret` and database `appdb`
- **THEN** `database` is `postgres://app:***@db.example:5432/appdb` and no output contains `secret`

#### Scenario: URL configuration

- **WHEN** `db.url` is `mysql://app:secret@db.example/appdb`
- **THEN** `database` is `mysql://app:***@db.example/appdb`
