# variant-worktrees

![variant-worktrees](./packages/variant-vscode/media/icon-256.png)

**Isolated tree+db for your agents :: watch, seed, implode**

📖 **[Read the documentation](https://jubr.github.io/variant-worktrees/)**

## Why

Three agents, one repository, one database. Each agent wants its own branch, its own dev servers, and its own data. Git worktrees give every agent its own checkout, but the database stays shared: one agent's migration breaks the others, a seed script wipes your test data, and two dev servers fight over port 3000.

A **variant** closes that gap. It is a git worktree that comes with its own database schema (PostgreSQL, MySQL, or a SQLite file), its own storage directory, and its own free ports. You get a place where an agent, or you, can change anything without touching anyone else's work. When the work is merged, the variant disappears completely.

It complements the agentic workflow: several agents work in their own variants while you watch the progress live.

## How it works

You describe your project once in [`variants.yaml`](#configuration). Then three commands cover the whole life of a variant. `watch` creates it and runs the project there, you or an agent do the work inside it, and `implode` removes it.

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

After `cd`, the slug comes from the branch, so `watch` and `implode` need no `-s`. `implode` stops the processes, drops the database and storage, and removes the worktree. It refuses `main` and work that is not merged into the base branch unless you pass `--force`. The branch itself stays.

## Install

[mise](https://mise.jdx.dev) installs the tools a project asks for and puts them on your `PATH` when you enter that directory. Add the CLI to a project:

```bash
mise use github:jubr/variant-worktrees
```

The VS Code extension (Variant Worktrees) is published to the Visual Studio Marketplace and Open VSX. The `variant-mcp` server and the `variant-api` library install from npm:

```bash
npm install -g variant-mcp
npm install variant-api
```

Releases also ship the `variant` CLI as a single-file executable for Linux, macOS, and Windows.

To try it on a working project, use [`example/`](./example) (Vite, NestJS, and SQLite). Seed, ports, and containers are in [`example/README.md`](./example/README.md).

```bash
cd example
variant config
variant create demo
variant watch demo --detach
```

## Configuration

Create `variants.yaml` at workspace root:

```yaml
variant:
  up: bun run db:migrate
  watch: bun run dev
  seed: bun run db:seed
  instances:
    fe:
      kind: vite
      dir: fe
      open: http://{{slug}}.vw.localhost:{{port}}
    be:
      kind: nestjs
      dir: be
```

The [`example/`](./example) project shows a complete setup (Vite + NestJS on SQLite). The
[configuration guide](https://jubr.github.io/variant-worktrees/guide/configuration) lists every runtime option.

Database settings load from `mise.local.toml` first, then environment
variables. Explicit `db` values in `variants.yaml` override autodetected
values.

Instances take an optional `open` URL template (`{{slug}}`, `{{port}}`; autodetected Vite instances get `http://{{slug}}.vw.localhost:{{port}}`) and an optional `dotenv` file, relative to `dir`, that is copied for a variant and amended with its values (`amendDotenv`, `dotenvFor`). Ephemeral state of a variant lives in `variants.local.yaml` in its worktree (git-ignored): a `runtime` section with `slug`, `mode`, `dir`, `db` (the `db` settings, port may be `'{{POSTGRES_PORT}}'` from the environment) and `instances.<name>.{port,pid,url}`; see [`variants.local.example.yaml`](./packages/variant-config/variants.local.example.yaml). `{{port}}` is `runtime.instances.<name>.port`, otherwise a random free port. `up` and `watch` write the section; `list` and `down` read it.

`variant.prefix` (default `_v-`, connector included) starts every name derived from a
slug, such as worktree directories (`_v-add-auth`). The optional `chatRenamer` section
configures the Cursor chat renamer in `variant-vscode`. Every option is listed in
[`variants.example.yaml`](./packages/variant-config/variants.example.yaml), next to the
[JSON schema](./packages/variant-config/variants.yaml.schema.json).

## CLI

```bash
variant config
variant create -s preview-one
variant list
variant provision -s preview-one
variant up -s preview-one              # instances as containers on a fresh database
variant watch -s preview-one --detach  # instances as host processes
variant down -s preview-one            # stop them, keep the data
variant implode -s preview-one         # tear down and remove the worktree
```

Without `-s`/`--slug`, the CLI derives a slug from the current git worktree.
PostgreSQL and MySQL use isolated schemas/databases; SQLite uses one database
file per variant. Every command is explained in the
[command reference](https://jubr.github.io/variant-worktrees/guide/core).

## MCP

Configure an MCP client to run:

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

Tools: `variant_config`, `variant_create`, `variant_list`, `variant_switch`,
`variant_provision`, `variant_up`, `variant_down`, `variant_watch` (always
detached), and `variant_implode`. See the [MCP guide](https://jubr.github.io/variant-worktrees/mcp).

## Chat renamer

[`chat-renamer`](./packages/chat-renamer-vscode/README.md) renames the Cursor chat from the first prompt, so every agent chat is named after its variant. `/chat-rename my-title` sets that title. An activation pattern does the same: `/vw-spec-start my-slug` becomes `my-slug`. When that extension and `variant-vscode` are both installed, `variant-vscode` owns renaming. Options live in the `chatRenamer` section of `variants.yaml` (see [Configuration](#configuration) and the [chat renamer guide](https://jubr.github.io/variant-worktrees/chat-renamer/)). An editor setting you set explicitly wins.

## Packages

- [`variant-config`](./packages/variant-config) — `variants.yaml` schema and
  mise/environment autodetection.
- [`variant-api`](./packages/variant-api) — lifecycle library and `variant`
  CLI.
- [`variant-mcp`](./packages/variant-mcp) — MCP tools for variant lifecycle
  operations.
- [`variant-vscode`](./packages/variant-vscode) — VS Code extension package.
  Embeds chat renamer.
- [`chat-renamer-api`](./packages/chat-renamer-api) — parse a Cursor chat rename
  request.
- [`chat-renamer-config`](./packages/chat-renamer-config) — schema for the
  `chatRenamer` section of `variants.yaml`.
- [`chat-renamer`](./packages/chat-renamer-vscode) — Cursor extension that
  renames a chat from its first prompt.

## Contributing

Building from source, tests, and the review workflow are described in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT
