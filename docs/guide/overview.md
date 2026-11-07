# Overview

A variant is a git worktree and the database schemas that belong to it. The commands below are the builtin steps. A later step implies the steps above it: `seed` implies `provision`, `provision` implies `create`, and `watch` implies `seed`. `down` is the exception and only stops watches. `deprovision` implies `down`. `implode` implies `deprovision`.

What the project itself runs is a step in `variant.steps`. The step is keyed by its name. `provision` and `deprovision` replace the builtin step of that name. `seed` is a script and there is no builtin seed. Every other name is a custom step, and it has exactly one of `runBefore` or `runAfter`.

## Flow of Steps

The builtin steps flow as follows:

`create` *→* `provision` *→* `seed` *→* `watch` *→* `down` *→* `deprovision` *→* `implode`

### create

Creates the git worktree and nothing else. The database is the next step.

```bash
variant create -s demo
```

### provision

Creates the schema `v_<slug>`, or, when `db.multi` is set, every schema of the variant in one pass. When `variant.steps` has a step named `provision`, that script runs instead, once, and the builtin creates nothing. The script creates the schemas and any extra role that uses them, and it handles every value of the list itself.

Implies `create`.

```yaml
variant:
  steps:
    provision:
      cmd: bun run db:provision
      dir: server
      env: &prov-env
        MULTI_TENANT_LIST: ${multi.tenants}
        MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}
```

### seed

The project supplies the script. The step named `seed` runs once and creates the tables and loads the rows. There is no builtin seed. With `db.multi` the script handles every schema itself. When the step is absent, nothing is seeded. `*prov-env` is the map anchored on the provision step.

Implies `provision`.

```yaml
variant:
  steps:
    seed:
      cmd: bun run db:seed
      dir: server
      env: *prov-env
```

### watch

Starts the watch processes and stays attached. Implies `seed`, so a watch creates the worktree, provisions and seeds before the processes start.

`--reprovision` runs `deprovision` first, then provisions and seeds again, then starts the watches.

```bash
variant watch
variant watch --reprovision
```

### down

Stops the watches of the variant. The schemas, the storage directory, the state and the worktree stay.

```bash
variant down
```

### deprovision

Drops the schema `v_<slug>`. When `db.multi` is set, it drops every schema under `db.multi.schemaPrefix`, including a value that has left the list. When `variant.steps` has a step named `deprovision`, that script runs instead, once, and the builtin drops nothing. The script removes the schemas and anything else, such as a role, and it handles every tenant itself. With no such step, only the schemas go. Implies `down`, so the watches stop before the schemas go. The storage directory, the state and the worktree stay. Slug `main` is refused.

```bash
variant deprovision
```

### implode

Implies `deprovision`, then removes the worktree and, by default, the local branch. `--branch-rm=no` keeps the branch.

```bash
variant implode
```

## Custom Steps

A custom step has exactly one of `runBefore` or `runAfter`. `runBefore` and `runAfter` name a builtin step (`create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`) or another custom step.

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

Setting `VARIANT_STEP_<STEP>=no` skips a step.
The name in the variable is the step name with letters uppercased and every other character replaced by `_`.

## Custom multi-tenancy steps

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

So with `slug=demo` and `.env` containing `WITCHES=east,west`, `watch` runs `db:provision:witches` once with `MULTI_TENANT_LIST=east,west` and `MULTI_SCHEMA_PREFIX=v_demo-`, then `db:seed:witches` once with the same vars, then `migrations` once. `deprovision` runs `db:deprovision:witches` once with the same vars and drops nothing itself. The script removes `v_demo-east`, `v_demo-west`, a leftover `v_demo-north` and any role.
