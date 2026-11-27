## MODIFIED Requirements

### Requirement: Sidebar groups

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then a VSCode / Cursor group, then Chat Renamer, then Development. Getting Started SHALL be a link to the site root above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Overview, then Installation, then Commands, then Configuration, then CLI, then Database, then Runtime, then Workspace. VSCode / Cursor SHALL list Extension, then the MCP server, then the Socket IPC page, and those three SHALL NOT be items of the Variant Worktrees group. Chat Renamer SHALL include the page named Extension and, under it, a configuration page, and SHALL sit above Development. Development SHALL list Building, then the library. The library SHALL NOT be an item of the Variant Worktrees group. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then VSCode / Cursor, then Chat Renamer, then Development
- **AND** Overview precedes Installation, which precedes Commands, which precedes Configuration, which precedes CLI, which precedes Database, which precedes Runtime, which precedes Workspace
- **AND** Workspace precedes the VSCode / Cursor group, which lists Extension, then the MCP server, then the Socket IPC page
- **AND** Chat Renamer lists its configuration page under the Extension page
- **AND** Development lists Building, then the library

### Requirement: Site layout

The pages of the site SHALL live in directories that match the sidebar: `index.md` is Getting Started and the landing page, `guide/` holds the Variant Worktrees pages (Overview, Installation, Commands, Configuration, CLI, Database, Runtime, Workspace), `vscode/` holds Extension, MCP server and Socket IPC, `chat-renamer/` holds the Chat Renamer pages, and `development/` holds Building and the library. The Commands page is `guide/commands`. What belongs to the command line itself (the global flags, which include the slug, and the shell completions) SHALL be on `guide/cli`. The library page SHALL hold the command definitions. Where another requirement names a page by an earlier URL or as Core, the page of this layout applies.

#### Scenario: Pages are where the sidebar says

- **WHEN** the built site is listed
- **THEN** it has `index.html`, `guide/commands.html`, `guide/cli.html`, `guide/database.html`, `vscode/extension.html`, `vscode/mcp.html`, `vscode/socket-ipc.html` and `development/library.html`
- **AND** it has no `guide/index.html`, `guide/core.html` or `cli-vscode-webview.html`
- **AND** the built library page has the heading Command definitions

## ADDED Requirements

### Requirement: Database page

The Database page, `guide/database`, SHALL open with a short introduction that says how the database is found (explicit `db` in `variants.yaml`, else Mise and process environment values, else SQLite), that a variant gets a PostgreSQL or MySQL schema or a SQLite file of its own, and that `variant create` prints it. It SHALL have the second-level sections *PostgreSQL*, *MySQL and MariaDB* and *SQLite*, in this order. Each section SHALL show an explicit `db` block of `variants.yaml` in fenced YAML and a file layout in a fenced `text` tree that names `variants.yaml`, `mise.toml` and `mise.local.toml`, and SHALL say that `mise.local.toml` holds the values that must not be committed and is not committed. *PostgreSQL* and *MySQL and MariaDB* SHALL show the `[env]` table of `mise.local.toml` in fenced TOML with the password, and the `db` block SHALL refer to it as `${POSTGRES_PASSWORD}` or `${MYSQL_PASSWORD}`, never as the value. They SHALL also show the variant's connection as `variant create` prints it, with the password as `***`, and the autodetected form where `variants.yaml` has no `db` at all. *MySQL and MariaDB* SHALL say that MariaDB is the type `mysql` and name `MARIADB_*` and `mariadb://`. *SQLite* SHALL say that `db.database` is the full absolute or relative file name, that `${slug}` stands for the slug, that a relative name is resolved in the worktree of the variant, and that without any setting the file is `.cache/variants/${slug}.sqlite`, and SHALL show the layout of a main checkout with one variant worktree and the file in each. It SHALL show `SQLITE_DATABASE` in `mise.local.toml` as the detected form. The page SHALL NOT contain a real credential, and every password in an example SHALL be a placeholder.

#### Scenario: Sections in order

- **WHEN** the second-level headings of the built Database page are listed
- **THEN** they are PostgreSQL, MySQL and MariaDB, SQLite, in that order

#### Scenario: Secrets live in mise.local.toml

- **WHEN** the PostgreSQL section of the built page is read
- **THEN** it has a fenced YAML `db` block with `password: ${POSTGRES_PASSWORD}`, a fenced `text` layout that lists `mise.local.toml`, and a fenced TOML block whose `[env]` table sets `POSTGRES_PASSWORD`
- **AND** the YAML block does not contain the password value

#### Scenario: Create output

- **WHEN** the PostgreSQL section is read
- **THEN** it shows a `database:` line of the form `postgres://<user>:***@<host>:<port>/<database>`

#### Scenario: SQLite file layout

- **WHEN** the SQLite section is read
- **THEN** it says that `db.database` is the full file name, absolute or relative, and shows a tree in which the main checkout and a `_v-` worktree each hold `.cache/variants/<slug>.sqlite`

### Requirement: Configuration page documents SQLite database files

The Configuration page SHALL document `db.database` for every type: the database name for PostgreSQL and MySQL, and for SQLite the full file name, absolute or relative, with the note that a relative name is resolved in the worktree of the variant and `${slug}` stands for the slug. It SHALL link to the Database page. It SHALL NOT have a heading `db.filename` and SHALL say, in *Unknown keys and migration*, that `db.filename` was renamed `db.database` and is rewritten by the migration.

#### Scenario: SQLite note

- **WHEN** the `db.database` section of the built Configuration page is read
- **THEN** it says that for SQLite the value is the full absolute or relative file name, mentions `${slug}`, and links to `database`

#### Scenario: No filename heading

- **WHEN** the third-level headings of the Database options section are listed
- **THEN** none is `db.filename` and `db.database` is among them
