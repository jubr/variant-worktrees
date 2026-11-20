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

## Flow of Steps

The steps flow as follows:

Installation *→* `create` *→* `provision` *→* `seed` *→* `watch` *→* `down` *→* `deprovision` *→* `implode`

### Installation

Installs mise and the `variant` command or the editor extension, and initializes your project with a `variants.yaml`.
Everything else starts from there. More details at [Installation](./installation).

### create

Creates the git worktree and nothing else. The database is the next step.
More details at Commands [`variant create`](./commands#variant-create).

### provision

Creates the database schema of the variant, or every schema of [`db.multi`](./configuration#db-multi), and implies `create`.
A step of the same name in [`variant.steps`](./configuration#variant-steps) replaces it.
More details at Commands [`variant provision`](./commands#variant-provision).

### seed

The project supplies the script.
The step named `seed` in [`variant.steps`](./configuration#variant-steps) runs once and creates the tables and loads the rows.
There is no builtin seed.
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

To set up a workspace around your Git project, see how the [Workspace](./workspace) is laid out and why the worktrees sit next to your main checkout.
How the steps follow one another is in the [Flow of Steps](#flow-of-steps) above: a later step implies the ones before it, so one `watch` can take a variant from nothing to running.
To configure `variants.yaml`, go through the [Variant options](./configuration#variant-options), and add your own [Custom Steps](./configuration#custom-steps) when the project needs them.
The commands you can run on the command line are listed on the [CLI](./cli) page, and each one is explained in [Commands](./commands).
To work from your editor, use the [Extension](/vscode/extension) for VS Code and Cursor, and give your agents the [MCP Server](/vscode/mcp).
To see how watches start, stay up and stop, read [Runtime](./runtime).
