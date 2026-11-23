# Overview

A variant is a git worktree and the database schemas that belong to it.
The commands below are the builtin steps.
A later step implies the steps above it: `seed` implies `provision`, `provision` implies `create`, and `watch` and `up` imply `seed`.
`down` is the exception and only stops watches. `deprovision` implies `down`.
`implode` implies `deprovision`.

What the project itself runs is a step in [`variant.steps`](./configuration#variant-steps).
The step is keyed by its name. `provision` and `deprovision` replace the builtin step of that name.
`seed` is a script and there is no builtin seed.
Every other name is a custom step, and it has exactly one of `runBefore` or `runAfter`; see [Custom Steps](./configuration#custom-steps).
Setting `VARIANT_STEP_<STEP>=no` skips a step.
The name in the variable is the step name with letters uppercased and every other character replaced by `_`.

## Installation

Install mise and the `variant` command or the editor extension, and initialize your project with a `variants.yaml`.
Everything else starts from there. More details at [Installation](./installation).

## Flow of Steps

The builtin steps flow as follows:

`create` *→* `provision` *→* `seed` *→* `watch` *→* `down` *→* `deprovision` *→* `implode`

### create

Creates the git worktree and nothing else. The database is the next step.
More details at Commands [`variant create`](./commands#variant-create).

### provision

Creates the database schema of the variant, or every schema of [`db.multi`](./configuration#db-multi), and implies `create`.
A step of the same name in [`variant.steps`](./configuration#variant-steps) replaces it.
More details at Commands [`variant provision`](./commands#variant-provision).

### seed

There is no builtin seed, the project will need to supply the logic.
The step named `seed` in [`variant.steps`](./configuration#variant-steps) runs once and creates the tables and loads the rows.
With [`db.multi`](./configuration#db-multi) the script handles every schema itself.
When the step is absent, nothing is seeded.

Implies `provision`.

```yaml
variant:
  steps:
    seed:
      cmd: bun run db:seed
      dir: server
```

### watch

Starts the watch processes and stays attached.
It implies `seed`, so the worktree, the schemas and the seed exist before the processes start.
More details at Commands [`variant watch`](./commands#variant-watch).

### down

Stops the watches of the variant.
The schemas, the storage directory, the state and the worktree stay.
More details at Commands [`variant down`](./commands#variant-down).

### deprovision

Stops the watches and drops the schemas of the variant.
The storage directory, the state and the worktree stay, and slug `main` is refused.
More details at Commands [`variant deprovision`](./commands#variant-deprovision).

### implode

Implies `deprovision`, then removes the worktree and, by default, the local branch.
More details at Commands [`variant implode`](./commands#variant-implode).

## Next steps

- Work from your editor, use the [Extension](/vscode/extension) for VS Code and Cursor.
- Set up a workspace around your Git project, see how a recommended [Workspace](./workspace) is laid out.
- Configure `variants.yaml` with [Variant options](./configuration#variant-options) and add your own [Custom Steps](./configuration#custom-steps) when needed.
- Find out how to run the [CLI](./cli) and [Commands](./commands) it exposes.
- See how watches start, stay up and stop, read [Runtime](./runtime).
