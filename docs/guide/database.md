# Database

Every variant gets a database of its own: a PostgreSQL or MySQL schema, or a SQLite file.
`variant create` prints it as the `database:` line, and [`variant status`](./commands#variant-status) and [`variant list`](./commands#variant-list) show the same value.

The database is found in this order:

1. An explicit [`db`](./configuration#database-options) block in `variants.yaml`.
2. Values from Mise (`mise.toml` and `mise.local.toml`) and the process environment, such as `POSTGRES_HOST` or `DATABASE_URL`.
3. SQLite, with the file `.cache/variants/{slug}.sqlite`.

`variant config` prints the result and says where each value came from, and [`variant init`](./commands#variant-init) writes what it found.
Whatever the source, the value ends up in the same setting, [`db.database`](./configuration#db-database).

A password never goes into `variants.yaml`.
It sits in `mise.local.toml`, which is not committed, and `variants.yaml` refers to it as `${NAME}`.

## PostgreSQL

The explicit form refers to the secrets in `mise.local.toml`:

```yaml
db:
  dialect: postgres
  host: ${POSTGRES_HOST}
  port: ${POSTGRES_PORT}
  user: ${POSTGRES_USER}
  password: ${POSTGRES_PASSWORD}
  database: my_project
```

`mise.local.toml` holds the values that must not be committed, and it is not committed:

```text
my-project/
├── variants.yaml      # committed: the db block above
├── mise.toml          # committed: tools and shared settings
└── mise.local.toml    # not committed: host, user and password
```

```toml
# mise.local.toml
[env]
POSTGRES_HOST = "127.0.0.1"
POSTGRES_PORT = "5432"
POSTGRES_USER = "app"
POSTGRES_PASSWORD = "<your-password>"
```

Without a `db` block in `variants.yaml` the same `[env]` table is detected, and `variants.yaml` needs nothing at all.
Add `POSTGRES_DB` there to name the database; `variant init` writes it as `database:`.

Each variant gets the schema `v_<slug>` in that database.
`variant create -s demo` prints the connection, with the password as `***`:

```text
Created demo
worktree:  /work/_v-demo
database:  postgres://app:***@127.0.0.1:5432/my_project
schema:    v_demo
```

A `DATABASE_URL` such as `postgres://app:<your-password>@127.0.0.1:5432/my_project` is detected too, and is printed with the password as `***` as well.

## MySQL and MariaDB

MariaDB is the dialect `mysql`.

```yaml
db:
  dialect: mysql
  host: ${MYSQL_HOST}
  port: ${MYSQL_PORT}
  user: ${MYSQL_USER}
  password: ${MYSQL_PASSWORD}
  database: my_project
```

`mise.local.toml` holds the values that must not be committed, and it is not committed:

```text
my-project/
├── variants.yaml      # committed: the db block above
├── mise.toml          # committed: tools and shared settings
└── mise.local.toml    # not committed: host, user and password
```

```toml
# mise.local.toml
[env]
MYSQL_HOST = "127.0.0.1"
MYSQL_PORT = "3306"
MYSQL_USER = "app"
MYSQL_PASSWORD = "<your-password>"
```

Without a `db` block the same table is detected.
For MariaDB the variables are `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD` and `MARIADB_DATABASE`, and a `DATABASE_URL` that starts with `mariadb://` is detected too.
They all resolve to `dialect: mysql`.

The schema of a variant is named `v_<slug>`. `variant create -s demo` prints:

```text
Created demo
worktree:  /work/_v-demo
database:  mysql://app:***@127.0.0.1:3306/my_project
schema:    v_demo
```

## SQLite

For SQLite, [`db.database`](./configuration#db-database) is the full file name, absolute or relative.
It is not a database name. `{slug}` stands for the slug of the variant.
A relative name is resolved in the worktree of the variant, and in the main checkout for `main`.
Without any setting the file is `.cache/variants/{slug}.sqlite`:

```yaml
db:
  dialect: sqlite
  database: .cache/variants/{slug}.sqlite
```

`mise.local.toml` is not needed for SQLite, because there is no secret.
It is where the detected form lives, when the file is not at the default:

```text
my-project/
├── variants.yaml      # committed: the db block above, or no db block at all
├── mise.toml          # committed: tools and shared settings
└── mise.local.toml    # not committed: SQLITE_DATABASE, when you set one
```

```toml
# mise.local.toml
[env]
SQLITE_DATABASE = "data/{slug}.sqlite"
```

`SQLITE_DATABASE`, `SQLITE_PATH` and a `DATABASE_URL` that starts with `sqlite:` are detected as [`db.database`](./configuration#db-database).

A main checkout with one variant has one file in each of them:

```text
my-project/                                 # main checkout
├── variants.yaml
├── .cache/variants/main.sqlite             # slug main
└── _v-demo/                                # worktree of slug demo
    └── .cache/variants/demo.sqlite
```

A relative [`db.database`](./configuration#db-database) without `{slug}`, such as `app.sqlite`, still gives every variant a file of its own, because each worktree resolves it in its own directory.
An absolute file name without `{slug}` is the file of `main`, and every other variant gets `<slug>` plus the same extension beside it.
A variant other than `main` whose file would be the file of `main` fails with an error that names the slug and [`db.database`](./configuration#db-database).

`variant create -s demo` prints the file as it is configured: relative, unless [`db.database`](./configuration#db-database) is absolute.

```text
Created demo
worktree:  /work/_v-demo
database:  .cache/variants/demo.sqlite
```

### Files of an earlier version

Earlier versions kept the files in `<directory of variants.yaml>/.cache/variants/{slug}.db` and had `db.filename`.
`db.filename` is now [`db.database`](./configuration#db-database), and the migration rewrites it (see [Unknown keys and migration](./configuration#unknown-keys-and-migration)).
When a `variants.yaml` has no [`db.database`](./configuration#db-database) and the old location holds `{slug}.db` files, the migration writes `db.database: <directory>/.cache/variants/{slug}.db` so those files stay in use.
Delete that line to move to the new default.
