# Overview

A variant is a git worktree and the database schemas that belong to it. The commands below are the builtin steps. A later step implies the steps above it: `seed` implies `provision`, `provision` implies `create`, and `watch` implies `seed`. `down` is the exception and only stops watches. `deprovision` implies `down`. `implode` implies `deprovision`.

What the project itself runs is a step in [`variant.steps`](./configuration#variant-steps). The step is keyed by its name. `provision` and `deprovision` replace the builtin step of that name. `seed` is a script and there is no builtin seed. Every other name is a custom step, and it has exactly one of `runBefore` or `runAfter`.

## Flow of Steps

The builtin steps flow as follows:

`create` *→* `provision` *→* `seed` *→* `watch` *→* `down` *→* `deprovision` *→* `implode`

### create

Creates the git worktree and nothing else. The database is the next step.

More details at [create](./core#create).

### provision

Creates the database schema of the variant, or every schema of [`db.multi`](./configuration#db-multi), and implies `create`. A step of the same name in [`variant.steps`](./configuration#variant-steps) replaces it.

More details at [provision](./core#provision).

### seed

The project supplies the script. The step named `seed` in [`variant.steps`](./configuration#variant-steps) runs once and creates the tables and loads the rows. [`variant.seed`](./configuration#variant-seed) sets the same command without a step. There is no builtin seed. With [`db.multi`](./configuration#db-multi) the script handles every schema itself. When the step is absent, nothing is seeded.

Implies `provision`.

```yaml
variant:
  steps:
    seed:
      cmd: bun run db:seed
      dir: server
```

### watch

Starts the watch processes and stays attached. It implies `seed`, so the worktree, the schemas and the seed exist before the processes start.

More details at [watch](./core#watch).

### down

Stops the watches of the variant. The schemas, the storage directory, the state and the worktree stay.

More details at [down](./core#down).

### deprovision

Stops the watches and drops the schemas of the variant. The storage directory, the state and the worktree stay, and slug `main` is refused.

More details at [deprovision](./core#deprovision).

### implode

Implies `deprovision`, then removes the worktree and, by default, the local branch.

More details at [implode](./core#implode).

## Custom Steps

A custom step has exactly one of [`runBefore`](./configuration#variant-steps-name-runbefore) or [`runAfter`](./configuration#variant-steps-name-runafter). They name a builtin step (`create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`) or another custom step.

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

With [`db.multi`](./configuration#db-multi) set, one provision run creates every schema under [`db.multi.schemaPrefix`](./configuration#db-multi-schemaprefix), and the list of tenants comes from [`db.multi.tenants`](./configuration#db-multi-tenants) or [`db.multi.tenantsCmd`](./configuration#db-multi-tenantscmd).

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
