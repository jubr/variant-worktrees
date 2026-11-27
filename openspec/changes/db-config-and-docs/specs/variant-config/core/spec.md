## ADDED Requirements

### Requirement: SQLite database file

For the `sqlite` type `db.database` SHALL be the database file of a variant: a full path, absolute or relative, that MAY contain the placeholder `${slug}` for the slug of the variant. The resolved configuration SHALL carry it as written, so `${slug}` stays in the value, and it is the one variant placeholder that `db` accepts; any other variant placeholder in `db.database`, and every one in another `db` setting, SHALL still fail naming the setting. A relative path is resolved per variant against the directory of that variant, as `variant-api` does. When no setting names a file, `db.database` SHALL be `.cache/variants/${slug}.sqlite`, both when the type was autodetected and when `db.type: sqlite` is set without `database`, and an explicit one SHALL NOT read the environment for it. An explicit `db.database` SHALL win over every detected value.

Environment detection SHALL stay as it is: `SQLITE_DATABASE` and `SQLITE_PATH` select the type. Both SHALL be read as `db.database`, `SQLITE_DATABASE` first, and neither SHALL be read as another field. A `DATABASE_URL` that starts with `sqlite:` SHALL yield the file it names as `db.database`: `sqlite:///<absolute path>` is that absolute path, and `sqlite:<path>`, `sqlite:./<path>` and `sqlite://<path>` are relative paths. `variant config` SHALL comment a `database` from the environment `# from env <NAME>` and the default `# default`.

#### Scenario: Default file

- **WHEN** `variants.yaml` sets no `db` and the environment has no database setting
- **THEN** `config.db.type` is `sqlite` and `config.db.database` is `.cache/variants/${slug}.sqlite`
- **AND** `variant config` comments the `database` line `# default`

#### Scenario: Explicit sqlite without a file

- **WHEN** `variants.yaml` has `db.type: sqlite` and no `database`
- **THEN** `config.db.database` is `.cache/variants/${slug}.sqlite`, and no environment is read

#### Scenario: Explicit file

- **WHEN** `variants.yaml` has `db.type: sqlite` and `db.database: abc.sqlite`
- **THEN** `config.db.database` is `abc.sqlite`, whatever the process cwd is

#### Scenario: Environment file

- **WHEN** `SQLITE_PATH` is `/tmp/app.sqlite` and `variants.yaml` sets no `db`
- **THEN** `config.db.type` is `sqlite` and `config.db.database` is `/tmp/app.sqlite`
- **AND** `config.db.filename` does not exist
- **AND** `variant config` comments the `database` line `# from env SQLITE_PATH`

#### Scenario: Both variables

- **WHEN** `SQLITE_DATABASE` is `a.sqlite` and `SQLITE_PATH` is `b.sqlite`
- **THEN** `config.db.database` is `a.sqlite`

#### Scenario: File in a connection URL

- **WHEN** `DATABASE_URL` is `sqlite:///var/data/app.sqlite`
- **THEN** `config.db.type` is `sqlite` and `config.db.database` is `/var/data/app.sqlite`

#### Scenario: Slug placeholder stays

- **WHEN** `variants.yaml` has `db.database: data/${slug}.sqlite`, or `SQLITE_DATABASE` is that value
- **THEN** `config.db.database` is `data/${slug}.sqlite`
- **AND** `db.database: ${abbr}/${slug}.sqlite` fails and names `db.database` and `abbr`

#### Scenario: Explicit file wins

- **WHEN** `variants.yaml` has `db.database: ./mine.sqlite` and `SQLITE_DATABASE` is `/tmp/app.sqlite`
- **THEN** `config.db.database` is `./mine.sqlite`

### Requirement: db.filename is read as db.database

The setting `db.filename` of an earlier version SHALL be read as `db.database` under the same rules as the other renames of "Legacy configuration is read under the current names": loading reads it in memory, writes nothing, produces a migration notice (the file, `db.filename` and `db.database`) and no unknown-key warning, the function that returns the migrated text keeps comments, key order and layout, and the file migration of the `variant` command and the extension rewrites it. When both are present `db.database` SHALL win and `db.filename` SHALL be dropped, with a notice. A `filename` in `.cache/variant/runtime.yaml` SHALL be read as `database` the same way. The JSON schema of `variants.yaml` SHALL NOT list `filename`.

#### Scenario: Former filename

- **WHEN** `variants.yaml` sets `db: { type: sqlite, filename: data/app.db }`
- **THEN** loading succeeds, `config.db.database` is `data/app.db`, one migration notice names `db.filename` and `db.database`, and there is no warning for `filename`

#### Scenario: Both names present

- **WHEN** `variants.yaml` sets `db.filename: old.db` and `db.database: new.sqlite`
- **THEN** `config.db.database` is `new.sqlite` and the notice says `db.filename` was ignored

#### Scenario: Text rewritten with comments kept

- **WHEN** the rewrite function gets a file whose `db.filename` line carries a trailing comment
- **THEN** the returned text names `database` instead, with that comment and every other line unchanged

### Requirement: The database type is db.type

The database type SHALL be the setting `db.type` (`postgres`, `mysql` or `sqlite`) and the key `type` of `state.yaml`, of `runtime.yaml` and of the variant records. A file of an earlier version that names it differently SHALL be read as `type` without a migration notice, without a warning and without a message on the console or in the editor. The rewrite of `variants.yaml` SHALL rename the key with its comments and layout kept, under the same conditions as the other renames, and SHALL drop the former key when `type` exists. The documentation SHALL NOT name the former key.

#### Scenario: Former key read silently

- **WHEN** `variants.yaml` sets `db: { dialect: sqlite }`
- **THEN** loading succeeds, `config.db.type` is `sqlite`, and there is no migration notice and no warning

#### Scenario: Former key rewritten silently

- **WHEN** the CLI runs on a tracked, clean `variants.yaml` whose `db` block has the former key
- **THEN** the file names `type` instead, with comments and every other line unchanged, and the CLI prints nothing about it

### Requirement: MySQL gets a database per variant

MySQL has no schemas, so `db.database` of type `mysql` MAY hold the placeholder `${schema}`, the schema name of the variant (`v_<slug>`), as in `project_x__${schema}`. Like `${slug}` for SQLite, the placeholder SHALL stay as written when `db` is loaded, while `${NAME}` references in the same value are resolved. Autodetection SHALL append `__${schema}` to a database name read from `MYSQL_DATABASE` or `MARIADB_DATABASE`, so detection and `variant init` give the same database per variant as the example of the Database page; it SHALL NOT add it to a name read for another type, and a `DATABASE_URL` alone SHALL give no database name. A `${schema}` in `db.database` of another type than `mysql`, and a `${slug}` in `db.database` of another type than `sqlite`, SHALL fail and name `db.database`. The database name that autodetection finds for another type SHALL NOT be used for an explicit `db.type`.

#### Scenario: Placeholder kept

- **WHEN** `variants.yaml` has `db: { type: mysql, host: h, database: "${MYSQL_DATABASE}__${schema}" }` and `MYSQL_DATABASE` is `project_x`
- **THEN** `config.db.database` is `project_x__${schema}`

#### Scenario: Detected prefix

- **WHEN** `MYSQL_HOST` is `h` and `MYSQL_DATABASE` is `shop`
- **THEN** the detected `database` is `shop__${schema}`
- **AND** a PostgreSQL detection with `POSTGRES_DB` `shop` keeps `shop`

#### Scenario: Placeholder of another type

- **WHEN** `variants.yaml` has `db.type: postgres` and `db.database: x_${schema}`
- **THEN** reading `config.db` fails naming `db.database` and `${schema}`

### Requirement: SQLite files of the former location are kept

Earlier versions stored the SQLite file of a variant in `<directory of variants.yaml>/.cache/variants/<slug>.db`. When the resolved type is SQLite, no `db.database` is set in `variants.yaml` and the environment names no SQLite file, and that directory holds at least one `.db` file, loading SHALL resolve `db.database` as `<absolute directory>/.cache/variants/${slug}.db`, so those files stay the databases of their variants, and SHALL add a migration notice that names the directory. Loading SHALL NOT write anything. The system SHALL offer a function that reports that value for a directory (nothing when the directory has no such file or a `db.database` is set), and the function that returns the migrated text SHALL accept it and set `db.database` to it, adding `db` and `type: sqlite` when the file has no `db`, keeping comments, key order and layout. The file migration of the `variant` command and the extension SHALL write it under the same rules as a rename, with the same notice. Once `db.database` is set, no further migration applies, and an `.sqlite` file in the new default location SHALL NOT trigger it. A `db.filename` of an earlier version is only renamed (see "db.filename is read as db.database"); its files are not searched for.

#### Scenario: Old files found

- **WHEN** `.cache/variants/demo.db` exists below the directory of `variants.yaml`, which sets no `db`, and the environment names no database
- **THEN** `config.db.database` is `<absolute directory>/.cache/variants/${slug}.db` and one migration notice names the directory
- **AND** nothing was written

#### Scenario: Old files found, file rewritten

- **WHEN** the same project runs a `variant` command and `variants.yaml` is tracked and unchanged
- **THEN** `variants.yaml` has `db.type: sqlite` and that `db.database`, and the next command prints no migration notice

#### Scenario: No old files

- **WHEN** `.cache/variants/` does not exist, or holds only `.sqlite` files
- **THEN** `config.db.database` is `.cache/variants/${slug}.sqlite` and there is no notice

#### Scenario: Explicit file wins

- **WHEN** `variants.yaml` sets `db.database: abc.sqlite` and `.cache/variants/demo.db` exists
- **THEN** `config.db.database` is `abc.sqlite` and there is no notice

#### Scenario: Text keeps comments

- **WHEN** the rewrite function gets a file whose `db` block has `type: sqlite # my choice` and the former-location value
- **THEN** the returned text adds `database` below `type` with that comment and every other line unchanged

#### Scenario: Old file still used

- **WHEN** `demo.db` of the former location exists and `provision` runs for `demo` after the migration
- **THEN** the database file of `demo` is `.cache/variants/demo.db` of that directory, and no `.sqlite` file is created

## MODIFIED Requirements

### Requirement: MariaDB detection

The system SHALL autodetect MariaDB as the `mysql` type: a `DATABASE_URL` that starts with `mariadb`, and the
variables `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD` and `MARIADB_DATABASE`, read like their
`MYSQL_` counterparts. When both a `MYSQL_` and a `MARIADB_` variable of one setting exist, the `MYSQL_` one SHALL win.
Postgres still SHALL be detected before MySQL and MariaDB, and those before SQLite.

#### Scenario: MariaDB URL

- **WHEN** `DATABASE_URL` is `mariadb://app@localhost/app`
- **THEN** the detected type is `mysql` and the URL is kept

#### Scenario: MariaDB variables

- **WHEN** mise defines `MARIADB_HOST`, `MARIADB_USER` and `MARIADB_DATABASE`
- **THEN** the detected `db` is `mysql` with that host and user, and `database` is the value of `MARIADB_DATABASE` followed by `__${schema}`

#### Scenario: MySQL wins

- **WHEN** `MYSQL_HOST=a` and `MARIADB_HOST=b` are both set
- **THEN** the detected host is `a`
