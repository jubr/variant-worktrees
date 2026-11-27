# Database

Every variant can optionally get a separate place to store its data: a PostgreSQL schema, MySQL database, or a SQLite file.

The database is found in this order:

1. An explicit [`db`](./configuration#database-options) block in `variants.yaml`.
2. Values from Mise (`mise.toml` and `mise.local.toml`) and the process environment, such as `POSTGRES_HOST` or `DATABASE_URL`.

`variant config` prints the result and says where each value came from, and [`variant init`](./commands#variant-init) writes what it found.
Whatever the source, the value ends up in the same setting, [`db.database`](./configuration#db-database).

A password never goes into `variants.yaml`: it prefers a file like `mise.local.toml` which is not committed.
In `variants.yaml` it's referred to as `${X_PASSWORD}`.

### Generic layout

The examples use the [workspace layout](./workspace): a folder `px/` that is not a git repository, with the primary checkout `project-x` in it, and a variant `_v-feature-42` next to it.
For all examples below the directory tree could look like this:

```text
px/
├── _v-feature-42/       # variant worktree, same files, same settings
├── project-x/           # primary checkout, branch main
│   ├── app/             # your app, accessing the db
│   ├── mise.toml        # committed: tools and shared settings
│   └── variants.yaml    # committed: the db block above
└── mise.local.toml      # not committed: host, user and password, found from every checkout below px/
```

So `mise.local.toml` sits in `px/`, not in the checkout, so Mise finds it from `project-x` and from every `_v-*` worktree, and each of them gets the same settings.

## PostgreSQL

In `variants.yaml` the explicit form refers to the secrets in `mise.local.toml`:

```yaml
# px/project-x/variants.yaml
db:
  type: postgres
  host: ${POSTGRES_HOST}
  port: ${POSTGRES_PORT}
  user: ${POSTGRES_USER}
  password: ${POSTGRES_PASSWORD}
  database: ${POSTGRES_DB}

variant:
  watches:
    app:
      dir: app/
      watch: bun run watch:dev
      env:
        overrides: # mise sets some from mise.local.toml, but left for completeness
          POSTGRES_HOST: ${POSTGRES_HOST}
          POSTGRES_PORT: ${POSTGRES_PORT}
          POSTGRES_USER: ${POSTGRES_USER}
          POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
          POSTGRES_DB: ${POSTGRES_DB}
          POSTGRES_SCHEMA: ${schema} # v_feature_42
```

Then [`watches.app`](./configuration#variant-watches) hands the same values to the app; `${schema}` is the schema of the variant it runs in.

```toml
# px/mise.local.toml
[env]
POSTGRES_HOST = "127.0.0.1"
POSTGRES_PORT = "5432"
POSTGRES_DB = "project_x"
POSTGRES_USER = "app"
POSTGRES_PASSWORD = "<your-password>"
```

Each variant gets the schema `v_<slug>` in that database.

```bash
$ variant create -s feature-42

Created feature-42
worktree:  /work/px/_v-feature-42
database:  postgres://app:***@127.0.0.1:5432/project_x
schema:    v_feature_42
```

A `DATABASE_URL` such as `postgres://app:<your-password>@127.0.0.1:5432/project_x` is also detected.

### Extra credit: Postgres docker as mise task

A task in the committed `mise.toml` can start the server that those values point at.
It reads the same `POSTGRES_*` variables, because Mise gives its tasks the environment of `mise.local.toml`, so the container and `variants.yaml` cannot disagree:

```toml
# px/project-x/mise.toml
[tasks."db:up"]
description = "Start PostgreSQL in Docker with the POSTGRES_* values"
run = '''
docker start px-postgres 2>/dev/null || docker run -d --name px-postgres --restart unless-stopped \
  -e POSTGRES_DB -e POSTGRES_USER -e POSTGRES_PASSWORD \
  -p "${POSTGRES_PORT:-5432}:5432" \
  -v px_postgres_data:/var/lib/postgresql \
  --health-cmd 'pg_isready -U "$POSTGRES_USER"' --health-interval 10s --health-timeout 5s --health-retries 5 \
  postgres:18-alpine
'''

[tasks."db:down"]
description = "Stop the PostgreSQL container, keeping its data"
run = "docker stop px-postgres"
```

`mise run db:up` creates the container the first time and starts it again after that; the data stays in the volume `px_postgres_data`.
`variant create` and `variant provision` then connect to it, and `variant implode` drops only the schema of that variant.

## MySQL and MariaDB

MariaDB resolves to type `mysql`.
Since MySQL does not support the concept of a Schema, the database has the lowercase slug appended, so the initial `${MYSQL_DATABASE}` effectively becomes a prefix when passed to the variant app:

```yaml
# px/project-x/variants.yaml
db:
  type: mysql
  host: ${MYSQL_HOST}
  port: ${MYSQL_PORT}
  user: ${MYSQL_USER}
  password: ${MYSQL_PASSWORD}
  database: ${MYSQL_DATABASE}__${schema} # also here, so Variant can provision

variant:
  watches:
    app:
      dir: app/
      watch: bun run watch:dev
      env:
        overrides:  # mise sets some from mise.local.toml, but left for completeness
          MYSQL_HOST: ${MYSQL_HOST}
          MYSQL_PORT: ${MYSQL_PORT}
          MYSQL_USER: ${MYSQL_USER}
          MYSQL_PASSWORD: ${MYSQL_PASSWORD}
          MYSQL_DATABASE: ${MYSQL_DATABASE}__${schema} # project_x__v_feature_42
```

Then [`watches.app`](./configuration#variant-watches) hands the same values to the app, as for PostgreSQL.
With MariaDB, write `MARIADB_*` in `mise.local.toml` and in this snippet instead of `MYSQL_*`:

```toml
# px/mise.local.toml
[env]
MYSQL_HOST = "127.0.0.1"
MYSQL_PORT = "3306"
MYSQL_USER = "app"
MYSQL_DATABASE = "project_x"
MYSQL_PASSWORD = "<your-password>"
```

For MariaDB the variables are `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD` and `MARIADB_DATABASE`, and a `DATABASE_URL` that starts with `mariadb://` is detected too.

```bash
$ variant create -s feature-42

Created feature-42
worktree:  /work/px/_v-feature-42
database:  mysql://app:***@127.0.0.1:3306/project_x__v_feature_42
```

## SQLite

For SQLite, [`db.database`](./configuration#db-database) is the full db file name, absolute or relative.
A relative name is resolved in the worktree of the variant, and in the main checkout for `main`.
The default value is `.cache/variants/${slug}.sqlite`:

```yaml
# px/project-x/variants.yaml
db:
  type: sqlite
  database: .cache/variants/${slug}.sqlite

variant:
  watches:
    app:
      dir: app/
      watch: bun run watch:dev
      env:
        overrides:
          SQLITE_DATABASE: ${schema} # .cache/variants/feature-42.sqlite
```

So [`watches.app`](./configuration#variant-watches) passes the filename for an app that reads `SQLITE_DATABASE`.
Dont need a `mise.local.toml` for SQLite, because there is no host/user/pass.

`SQLITE_DATABASE`, `SQLITE_PATH` and a `DATABASE_URL` that starts with `sqlite:` are detected as [`db.database`](./configuration#db-database).

With the default, the primary checkout and the variant hold one file each, inside their own worktree:

```text
px/
├── _v-feature-42/
│   └── .cache/variants/feature-42.sqlite
└── project-x/
    └── .cache/variants/main.sqlite
```

### One file per variant

A file name without `${slug}` can still give every variant a file of its own, and it depends on whether the name is relative or absolute.

A relative name, such as `app.sqlite`, is resolved in the worktree of each variant, so every worktree has its own file of that name:

```yaml
db:
  type: sqlite
  database: app.sqlite
```

```text
px/
├── _v-feature-42/
│   └── app.sqlite             # slug feature-42, another file in another directory
└── project-x/
    └── app.sqlite             # slug main
```

An absolute name without `${slug}` is one file for every worktree, so it can only belong to `main`.
Every other variant gets its slug before the same extension, beside it:

```yaml
db:
  type: sqlite
  database: /data/app.sqlite
```

```text
/data/
├── app.sqlite                 # slug main
└── feature-42.sqlite          # slug feature-42
```

A variant other than `main` whose file would be the file of `main` fails with an error that names the slug and [`db.database`](./configuration#db-database).

`variant create -s feature-42` prints the file as it is configured: relative, unless [`db.database`](./configuration#db-database) is absolute.

```text
Created feature-42
worktree:  /work/px/_v-feature-42
database:  .cache/variants/feature-42.sqlite
```
