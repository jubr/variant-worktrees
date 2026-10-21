# Getting Started

Variant Worktrees manages git worktrees, database schemas, watches, environment variables, and implodes. It comes as a CLI, an MCP server, a VS Code extension, and a library.

It complements the agentic workflow, where several agents work in their own variants while you watch the progress live.

## How it works

A variant is a worktree with its own database target. `watch` creates it and runs the project there. You, or an agent, do the work inside it. `implode` stops what is running and removes the worktree.

### Agent

An agent names the variant and stays in its own directory:

```bash
variant watch -s feature-forty-two
# do the work
variant implode -s feature-forty-two
```

`watch` creates the worktree `_v-feature-forty-two`, starts the dev processes, and keeps them up so you can see the progress. `implode` stops them and removes the worktree.

### Human

You step into the worktree and work there yourself:

```bash
variant create -s feature-forty-two
cd _v-feature-forty-two
variant watch
# browse, edit, commit, and push
variant implode # implies down
```

`create` makes the worktree. After `cd`, the slug comes from the branch, so `watch` and `implode` need no `-s`. `implode` includes `down`: it stops the processes, drops the database and storage, and removes the worktree.

`-s`/`--slug` overrides git detection. Without it, the current worktree branch determines the slug. Every command is explained in [Core](./core).

## In another project

[mise](https://mise.jdx.dev) installs the tools a project asks for and puts them on your `PATH` when you enter that directory. Add the CLI there:

```bash
mise use github:jubr/variant-worktrees
```

`variant` is then available in that project. A checkout of this repository builds the CLI instead: see [Building](/development/building).

What `watch` runs, which ports it picks, and which database it uses live in `variants.yaml`. Instances, templates, and every option are in [Configuration](./configuration). Database settings load from `mise.local.toml`, then environment variables.

## Requirements

- the `variant` CLI
- PostgreSQL, MySQL, or SQLite, each optional
