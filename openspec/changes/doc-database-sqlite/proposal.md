## Why

In a project with no database setting at all (SQLite by autodetection), four commands name four different SQLite targets for the same variant setup:

1. `variant config` prints `db.filename` as `.cache/variants/variants.db`, a file no command ever creates: variants get `.cache/variants/<slug>.db`.
2. `variant create -s demo` records and prints the target `.cache/variants/demo.db`, which is not the configured `filename`.
3. The runtime state of the main checkout says `db.filename: public`. The main checkout's target is `db.schema ?? "public"` for every dialect, so a SQLite project hands `SQLITE_DATABASE=public` to the watches of `main`, a relative file named `public`.
4. Two settings name the same thing: `db.database` (the database name of the other dialects, fed by `SQLITE_DATABASE`) and `db.filename` (fed by `SQLITE_PATH`). A `sqlite:` `DATABASE_URL` selects the dialect and its file is ignored. A relative path follows the process cwd, so the file depends on where the command was started.

Besides, `variant create` prints `target` and `dialect`, which say nothing about where the data is: not a file for SQLite, not a connection for the server dialects. And the documentation has no page that shows, per database, a working `variants.yaml` and where the secrets live.

## What Changes

- **BREAKING (sunset):** `db.filename` is replaced by `db.database`. For SQLite `db.database` is the database file, a full absolute or relative path that may contain `{slug}`. A `variants.yaml` that still has `db.filename` is read as `db.database` with a migration notice, and the file migration rewrites it, like the former `variant.instances`. Both present: `db.database` wins.
- The default is `.cache/variants/{slug}.sqlite` (the extension `.sqlite`, not `.db`), for the detected default and for an explicit `db.dialect: sqlite` without `db.database`.
- A relative `db.database` is resolved against the directory of the variant: its worktree (`<root>/<prefix><slug>`), or the main checkout for `main`. So every variant keeps its own file below its own worktree, and `variant config` prints the relative text as written.
- The slug `main` uses the same resolution as every slug (`main.sqlite` by default). It no longer gets the target `public` for SQLite.
- An absolute `db.database` without `{slug}` is the file of `main`; other slugs get `<slug>` plus the same extension in the same directory. A slug that would map onto the file of `main` is refused, naming both.
- Detection stays as it is (`SQLITE_DATABASE`, `SQLITE_PATH` and a `sqlite:` `DATABASE_URL`), but all of them feed `db.database`. `variant init` writes the detected file as `db.database`.
- `variant create` and `variant status` print `worktree` and `database` instead of `target` and `dialect`. `database` is the file as `db.database` names it for the slug: relative to the worktree (`.cache/variants/demo.sqlite`) unless `db.database` is absolute; for the server dialects `postgres://` or `mysql://` with the password shown as `***`, plus a `schema` line. `variant list` gets a last column `database`. `VariantRecord` gains the `database` string, so JSON and YAML output carry it too.
- `status` shows the SQLite file as `runtime.db.database`.
- A migration keeps the files of the former location: when the default applies and `<dir of variants.yaml>/.cache/variants/` holds `*.db` files, `db.database` resolves to `<that dir>/.cache/variants/{slug}.db` with a notice, and the file migration writes it into `variants.yaml` (adding `db` when there is none).
- Docs: the sidebar order becomes Commands, Configuration, CLI, Database, Runtime, Workspace. A new page `guide/database` gives explicit examples for PostgreSQL, MySQL (and MariaDB) and SQLite, each with a file layout that shows `mise.local.toml` as the home of the secrets. The Configuration page documents `db.database` with a note that for SQLite it is the full file name, and drops `db.filename`. README and CHANGELOG follow.
- Non-goals: `variant init` still writes no `db` key when nothing is detected; no change for PostgreSQL or MySQL targets; no change to `db.multi`; the legacy `.cache/variants/<slug>.yaml` state read stays as it is; `up` and `watch` keep their `target` line; an old explicit `db.filename` is only renamed, its files are not searched for.

## Capabilities

### New Capabilities

- `variant-cli/variant-text`: what the text of `variant create`, `variant status` and `variant list` shows for the worktree and the database.

### Modified Capabilities

- `variant-config/core`: new requirements "SQLite database file", "db.filename is read as db.database" and "SQLite files of the former location are kept".
- `variant-api/core`: "Multi-DB strategy" names the resolved file; new requirements "SQLite target of every slug" and "Variant records name their database".
- `variant-api/init`: a new requirement "Init writes the detected SQLite file".
- `variant-api/status`: "Status carries the runtime meta information" names `db.database` for SQLite.
- `variant-api/commands`: "List default output" gains the `database` column.
- `docs/site`: "Sidebar groups" and "Site layout" gain the Database page and the new order; new requirements "Database page" and "Configuration page documents SQLite database files".

## Impact

- `packages/variant-config/src/autodetect.ts`, `schema.ts`, `legacy.ts`, `local.ts`, a new reader of the former location, `index.ts`, `init-config.ts`, `origins.ts`, the generated `variants.yaml.schema.json`, `variants.example.yaml`, and sibling specs.
- `packages/variant-api/src/db/sqlite.ts`, `operations/create.ts`, `run-context.ts`, `operations/records.ts`, `types.ts`, and sibling specs.
- `packages/variant-cli/src/text.ts`, `table.ts` and their specs, and the migration step of `variant-cli` that writes `variants.yaml`; MCP and UI consumers of `VariantRecord` take the new field.
- `docs/.vitepress/config.ts`, `docs/guide/database.md` (new), `docs/guide/configuration.md`, `docs/guide/runtime.md`, `docs/guide/commands.md`, `README.md`, `CHANGELOG.md`, `scripts/docs-site.spec.ts`.
- The `state.yaml` of a main checkout written by an earlier version holds the target `public` for SQLite; the next command that records identity replaces it.
