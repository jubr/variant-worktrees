# MCP Server

`variant-mcp` exposes database variant lifecycle operations to MCP clients.

## Setup

Run the server with a workspace configuration:

```bash
variant-mcp --config /workspace/variants.yaml
```

MCP client configuration:

```json
{
  "mcpServers": {
    "variant": {
      "command": "variant-mcp",
      "args": ["--config", "/workspace/variants.yaml"]
    }
  }
}
```

## Available tools

- `variant_init({ prefix, file, gitignore, mise, force })` — bootstrap the working directory of the server: write `variants.yaml` from autodetection, add `<prefix>*` to `.gitignore` and the CLI to the Mise configuration; each of `file`, `gitignore` and `mise` is on unless `false`. It returns what each step did and acts in-process, not through the editor.
- `variant_config` — print resolved configuration.
- `variant_list({ verbose })` — list state and database variants with their mode, uptime and watch log file; with `verbose` every item carries all meta information, the same as `variant_status`.
- `variant_status({ slug })` — everything known about one variant: the facts of `variant_list` plus a `runtime`
  object with its runtime state (mode, directory, database settings with the password hidden, and per watch the
  port, pid, URL, liveness and uptime). An unknown slug is an error.
- `variant_create({ slug, from })` — create an isolated variant. `from` is a commit, tag, or branch a new branch starts at. Omit it and the branch starts at `variant.baseBranch`. An existing worktree or prefixed branch is left as it is.
- `variant_provision({ slug, from, verbose })` — run configured install, env file, `up`, step and seed commands. `from` is the same start commit as `variant_create`.
- `variant_up({ slug, from, verbose })` — run the watches as containers after provision and seed; returns the
  mode, worktree, database target, and the port, URL and container name of each watch.
- `variant_down({ slug })` — stop the processes and containers of a variant and keep its data.
- `variant_deprovision({ slug, verbose })` — stop the watches and drop the schemas. A `deprovision` script replaces the drop. It refuses `main` and leaves the worktree.
- `variant_watch({ slug, from, verbose, reprovision })` — start the watch processes detached and return their pids, ports and
  URLs; their output goes to `.cache/variant/watch.log` in the worktree (see `log` of `variant_status`). `from` is the same start commit as `variant_create`. `reprovision` drops the schemas before provisioning again. A tool call cannot stay attached to a console, so `detach` is always set. `variant_list` and `variant_status` carry `schemas` when `db.multi` is set.
- `variant_implode({ slug, force })` — stop the variant, drop its database and storage, clear its state and
  remove its worktree. It refuses `main` and work that is not merged into `variant.baseBranch`, including a branch started with `from`; the error names
  `force`, which overrides the gate.

There is no `variant_destroy`; `variant_implode` replaces it.

`slug` is optional for operations that support git worktree detection. Explicit
slugs always take precedence.

## Testing

```bash
mise x -- bun test packages/variant-mcp/test/mcp.test.ts
```
