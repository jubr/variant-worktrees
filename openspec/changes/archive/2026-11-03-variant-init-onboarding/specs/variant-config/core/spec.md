## ADDED Requirements

### Requirement: Interpolation in every setting

The system SHALL accept `${NAME}` and `${NAME:-default}` (the environment) and, in settings that belong to a variant,
the placeholders `${slug}`, `${abbr}`, `${schema}`, `${storage}`, `${worktree}`, `${url}`, `${port}` and
`${<key>.port}` in every string value of `variants.yaml`, except values that are regular expressions
(`variant.steps[].filterLinesRegex` and `chatRenamer.activationPatterns`). The values SHALL be expanded where they are
used, including `db` (environment references only), commands (`watch`, `up`, `install`, `seed`, steps), `env`, `url`,
`dir` and `preRm`. `NAME` SHALL be read as specified in [specs/tools/mise](../../tools/mise/spec.md) (Environment read through Mise). Placeholder names win over environment
names of the same spelling. A default MAY hold a placeholder: `${SECRET:-local-${slug}}`. A reference to a variable that
is set nowhere and has no default SHALL fail with an error that names the setting and the variable; so SHALL a variant
placeholder in a setting that has no variant (such as `db`). `$${` SHALL stand for a literal `${`, for text that a
shell must see. The syntax `{{...}}` is the former one (see the legacy requirement below).

#### Scenario: Password from mise

- **WHEN** `variants.yaml` has `db.password: ${POSTGRES_PASSWORD}` and mise defines `POSTGRES_PASSWORD = "s3"`
- **THEN** the resolved `db.password` is `s3`

#### Scenario: Process environment

- **WHEN** Mise does not define `DATABASE_URL` and the process environment does
- **THEN** `db.url: ${DATABASE_URL}` resolves to that value

#### Scenario: Default

- **WHEN** `db.host` is `${DB_HOST:-127.0.0.1}` and `DB_HOST` is set nowhere
- **THEN** the resolved host is `127.0.0.1`

#### Scenario: Unset variable

- **WHEN** `db.password` is `${MISSING}` and `MISSING` is set nowhere
- **THEN** using the database fails naming `db.password` and `MISSING`

#### Scenario: Placeholder in a command

- **WHEN** a watch sets `watch: bun run dev --port ${port}` with port 62061
- **THEN** the command that runs is `bun run dev --port 62061`

#### Scenario: Default with a placeholder

- **WHEN** a step env value is `${JWT_SECRET:-local-${slug}}` for `demo` and `JWT_SECRET` is unset
- **THEN** the value is `local-demo`

#### Scenario: Placeholder without a variant

- **WHEN** `db.schema` is `${slug}`
- **THEN** using the database fails naming `db.schema` and `slug`

#### Scenario: Literal for the shell

- **WHEN** a command is `echo $${HOME}`
- **THEN** the command that runs is `echo ${HOME}`

#### Scenario: Regular expressions untouched

- **WHEN** `filterLinesRegex` is `^price: ${PRICE}$` and `PRICE` is set nowhere
- **THEN** the regular expression is used as written and no error occurs

### Requirement: Legacy template syntax

The system SHALL read `{{...}}` placeholders and environment templates of `variants.yaml` and `variants.local.yaml` as
their `${...}` forms (`{{slug}}` as `${slug}`, `{{NAME:-x}}` as `${NAME:-x}`, a nested `{{A:-{{slug}}}}` as
`${A:-${slug}}`) and SHALL treat each file that contains them as migrated: it produces a migration notice, and the
function that returns the migrated text of a file, with its comments and layout kept, SHALL also rewrite them. This is
the mechanism of "Legacy configuration is read under the current names"; the file is written only by the callers
named there. Text of a value that does not have a placeholder shape SHALL stay as it is.

#### Scenario: Former placeholder

- **WHEN** a watch sets `url: http://{{slug}}.{{abbr}}.localhost:{{port}}`
- **THEN** loading succeeds, the URL renders as with `${slug}`, `${abbr}` and `${port}`, and one migration notice names the file

#### Scenario: Former nested default

- **WHEN** a value is `{{SECRET:-local-{{slug}}}}`
- **THEN** the migrated text is `${SECRET:-local-${slug}}`

#### Scenario: Rewrite

- **WHEN** the migrated text of a file with `PORT: '{{port}}'` is requested
- **THEN** it holds `PORT: '${port}'` and every other character is unchanged

#### Scenario: Local runtime state

- **WHEN** `variants.local.yaml` has `runtime.db.port: '{{POSTGRES_PORT}}'`
- **THEN** it resolves as `${POSTGRES_PORT}` and the file is a migration candidate

### Requirement: MariaDB detection

The system SHALL autodetect MariaDB as the `mysql` dialect: a `DATABASE_URL` that starts with `mariadb`, and the
variables `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD` and `MARIADB_DATABASE`, read like their
`MYSQL_` counterparts. When both a `MYSQL_` and a `MARIADB_` variable of one setting exist, the `MYSQL_` one SHALL win.
Postgres still SHALL be detected before MySQL and MariaDB, and those before SQLite.

#### Scenario: MariaDB URL

- **WHEN** `DATABASE_URL` is `mariadb://app@localhost/app`
- **THEN** the detected dialect is `mysql` and the URL is kept

#### Scenario: MariaDB variables

- **WHEN** mise defines `MARIADB_HOST`, `MARIADB_USER` and `MARIADB_DATABASE`
- **THEN** the detected `db` is `mysql` with that host, user and database

#### Scenario: MySQL wins

- **WHEN** `MYSQL_HOST=a` and `MARIADB_HOST=b` are both set
- **THEN** the detected host is `a`
