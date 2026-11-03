# variant-worktrees

![variant-worktrees](./packages/variant-vscode/media/icon-256.png)

**Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode**

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

`watch` creates the worktree `_v-feature-forty-two` (next to the repository when a parent `AGENTS.md` symlinks into it, else inside it; see `variant.root`), starts the dev processes, and keeps them up so you can see the progress. `implode` stops them and removes the worktree.

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

The VS Code extension (Variant Worktrees) is published to the Visual Studio Marketplace and Open VSX. The `variant` CLI (`variant-cli`), the `variant-mcp` server and the `variant-api` library install from npm. All run on Node.js 22.13 or newer and on Bun:

```bash
npm install -g variant-cli
npm install -g variant-mcp
npm install variant-api
```

`variant-api` is the library only and provides no `variant` command; `variant-cli` provides it. Releases also ship the `variant` CLI as a single-file executable for Linux, macOS, and Windows.

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
  seed: bun run db:seed
  watches:
    fe:
      kind: vite
      dir: fe
      watch: bun run dev
      url: http://{{slug}}.vw.localhost:{{port}}
    be:
      kind: nestjs
      dir: be
      up: bun run db:migrate
      watch: bun run start:dev
      env:
        sourceFile: .env # copied for a variant
        overrides: { PORT: '{{port}}' }
```

The [`example/`](./example) project shows a complete setup (Vite + NestJS on SQLite). The
[configuration guide](https://jubr.github.io/variant-worktrees/guide/configuration) lists every runtime option.

Database settings load from `mise.local.toml` first, then environment
variables. Explicit `db` values in `variants.yaml` override autodetected
values.

Watches take an optional `url` template (`{{slug}}`, `{{abbr}}`, `{{port}}`; autodetected Vite watches get `http://{{slug}}.{{abbr}}.localhost:{{port}}`) and an optional `env` with a `sourceFile`, relative to `dir`, that is copied for a variant and amended with `overrides` and the storage variable when the copy is created (`amendDotenv`, `dotenvFor`). A `container` is a `dockerfile` and an optional `internalPort`. Ephemeral state of a variant lives in `variants.local.yaml` in its worktree (git-ignored): a `runtime` section with `slug`, `mode`, `dir`, `log`, `db` (the `db` settings, port may be `'{{POSTGRES_PORT}}'` from the environment) and `watches.<name>.{port,pid,url}`; see [`variants.local.example.yaml`](./packages/variant-config/variants.local.example.yaml). `{{port}}` is `runtime.watches.<name>.port`, otherwise a random free port. `up` and `watch` write the section; `list`, `status` and `down` read it.

`variant.abbr` is a short label of the project for hostnames (`variant-worktrees` becomes `vw`, `OtherTitleCase` `otc`, `lower_example` `le`); it comes from the directory name of the main checkout unless you set it. A free port of a watch or of the UI server comes from `variant.ports.range` (default `42000-42999`; an explicit `VARIANT_<KEY>_PORT` may lie anywhere). The watch key `variant-ui` is reserved for the UI server, and so is `ui`: `VARIANT_UI_PORT` (or `variant.ui.port`) sets the server's port.

`variant.prefix` (default `_v-`, connector included) starts every name derived from a
slug, such as worktree directories (`_v-add-auth`). The optional `chatRenamer` section
configures the Cursor chat renamer in `variant-vscode`. Every option is listed in
[`variants.example.yaml`](./packages/variant-config/variants.example.yaml), next to the
[JSON schema](./packages/variant-config/variants.yaml.schema.json).

A key `variants.yaml` or `variants.local.yaml` does not know is a warning, not an error: the command prints one line per key on standard error and runs without it. A value of the wrong type is still an error.

### Migrating from earlier names

`variant.instances` and `runtime.instances` are now `variant.watches` and `runtime.watches`, and `variant.reservedPorts` is gone (see `variant.ports.range`). The old names still load, with a notice on standard error. The `variant` CLI and the VS Code extension then rewrite the file in place, keeping comments and layout, when `variants.yaml` is tracked by git and has no uncommitted changes (and always for the git-ignored `variants.local.yaml`), so `git diff` shows the change and `git checkout -- variants.yaml` reverts it. An untracked `variants.yaml` is rewritten after its old text is saved as `variants.yaml~`. Nothing is rewritten when `CI` is set (other than empty, `0` or `false`) or `VARIANT_MIGRATE=0`. The library, the MCP server and `variant ui` never write the files. The same rewrite adds the `yaml-language-server` schema header to a file that has none, so editors validate it; see the [configuration guide](https://jubr.github.io/variant-worktrees/guide/configuration).

### Environment variables

The `VARIANT_*` variables map to `variants.yaml` settings and template placeholders, in one or both directions.

| Variable | Direction | Setting or placeholder |
| --- | --- | --- |
| `VARIANT_SLUG` | set for commands | `{{slug}}` |
| `VARIANT_TARGET` | set for commands | `{{schema}}`: the database schema, or the SQLite file |
| `VARIANT_CONFIG` | set for commands | the path of the loaded `variants.yaml` |
| `VARIANT_<KEY>_PORT` | set for commands, and read as an override | `{{<key>.port}}` and `runtime.watches.<key>.port` |
| `VARIANT_<KEY>_URL` | set for commands, and read as an override | the rendered `url` and `runtime.watches.<key>.url` |
| `VARIANT_<KEY>_PID` | read as an override | `runtime.watches.<key>.pid` |
| `VARIANT_OPEN` | read as an override | `variant.open`; `0` turns opening off and wins |
| `VARIANT_MIGRATE` | read as an override | the rewrite of configuration files that use names of an earlier version; `0` turns it off |
| `VARIANT_ENV_SOURCE` | read as an override | `env.sourceFile`: the file a watch's env file is copied from, instead of the primary worktree's |
| `VARIANT_STEP_<NAME>` | read as an override | the `name` of a step in `variant.steps`; `no` skips the step |
| `VARIANT_UI_PORT` | read as an override | `variant.ui.port`: the port of the `variant ui` server |

`<KEY>` is the key of a watch and `<NAME>` the `name` of a step, with letters uppercased and every other character replaced by `_`: `VARIANT_BE_PORT` for `be`, `VARIANT_STEP_DEMO_USER=no` for `demo-user`. A variable that is set for commands is part of the environment of the install, `up`, step and seed commands and of containers (which receive the variables only, see `container`); an override is read from the environment of the `variant` process.

## CLI

```bash
variant config
variant create -s preview-one
variant list                           # slug, mode, uptime, full url, watch log file, dir
variant list -v                        # all meta information of every variant
variant status preview-one             # everything known about one variant
variant provision -s preview-one
variant up -s preview-one              # watches as containers on a fresh database
variant watch -s preview-one --detach  # watches as host processes
variant down -s preview-one            # stop them, keep the data
variant implode -s preview-one         # tear down and remove the worktree
variant ui --detach                    # the variants web page: print its URL with the token, keep serving
variant ui --stop                      # end the UI server of the project
```

Without `-s`/`--slug`, the CLI derives a slug from the current git worktree.
PostgreSQL and MySQL use isolated schemas/databases; SQLite uses one database
file per variant. Every command is explained in the
[command reference](https://jubr.github.io/variant-worktrees/guide/core).

`variant status` reports one variant: the facts `list` shows plus all of its runtime state (mode,
directory, database settings with the password hidden, and each watch's port, pid, URL, whether the
process is alive, and how long it has run). `variant watch --detach` writes the output of all its processes
to `variants.watch.log` in the worktree, so you can follow it in real time with `tail -f`; `list` and `status`
show the path. Commands print text for people. Add a global flag for a machine-readable result.

### Global flags

These work on every command, before or after the command name, and are listed apart from each command's own
flags in `variant --help` and `variant <command> --help`.

| Flag | Effect |
| --- | --- |
| `--json` | Print the result as JSON |
| `--yaml` | Print the result as YAML |
| `--help`, `-h` | Show help |
| `--version` | Show the version (top level only) |

Give at most one of `--json` and `--yaml`.

### Shell completion

Completion scripts for `zsh`, `bash`, and `fish` come from `variant completions <shell>`. They complete the
subcommands, the flags of each one, and the slugs of existing variants, read live from the local variant state and
`_v-*` worktrees (never the database). Regenerate the script after you upgrade `variant`; the `eval`/`source` forms do
it on every shell start.

```bash
# zsh: after compinit, in ~/.zshrc
eval "$(variant completions zsh)"
# or save it where $fpath finds it: variant completions zsh > ~/.zsh/completions/_variant

# bash: in ~/.bashrc
source <(variant completions bash)

# fish
variant completions fish > ~/.config/fish/completions/variant.fish
```

## See your variants

The extension adds a **Variant Worktrees** section to the Explorer. Each variant shows a watching, up or down icon and its uptime. **Sort**, left of Open Variants Panel, orders by name, created or changed (`variant.sort`, default name ascending). The play icon is **variant watch** (a detached `watch`). Stop brings the variant down. The trash icon sits at the right of every row except `main`: theme foreground when implode would succeed, red when it would fail. The context menu shows a variant's watch output, opens its URL, opens the panel and the web page. The view follows changes made by the CLI, an agent over MCP or another window within seconds. **Variant: Open Variants Panel** shows the same list, in the same order, in an editor panel.

`variant ui` serves the same app as a web page. It listens on loopback only, prints `http://ui.<abbr>.localhost:<port>/?token=<token>`, rejects requests without the token or with a foreign `Host`, accepts POSTs as `application/json` only, and implodes only after an explicit confirmation (never `main`). It records itself as the reserved `variant-ui` watch of `main`, so `variant list` shows it, and keeps its token in an owner-only file next to the editor socket. **Variant: Open Variants in Browser** opens a running server; without one it names `variant ui --detach`. The extension needs VS Code 1.101 or a host with Node.js 22.13 or newer.

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

Tools: `variant_config`, `variant_create`, `variant_list`, `variant_status`,
`variant_provision`, `variant_up`, `variant_down`, `variant_watch` (always
detached), and `variant_implode`. See the [MCP guide](https://jubr.github.io/variant-worktrees/mcp).

## Chat renamer

[`chat-renamer`](./packages/chat-renamer-vscode/README.md) renames the Cursor chat from the first prompt, so every agent chat is named after its variant. `/chat-rename my-title` sets that title. An activation pattern does the same: `/vw-spec-start my-slug` becomes `my-slug`. When that extension and `variant-vscode` are both installed, `variant-vscode` owns renaming. Options live in the `chatRenamer` section of `variants.yaml` (see [Configuration](#configuration) and the [chat renamer guide](https://jubr.github.io/variant-worktrees/chat-renamer/)). An editor setting you set explicitly wins.

## Packages

- [`variant-config`](./packages/variant-config) — `variants.yaml` schema and
  mise/environment autodetection.
- [`variant-api`](./packages/variant-api) — lifecycle library for Node.js and
  Bun.
- [`variant-cli`](./packages/variant-cli) — the `variant` command.
- [`variant-mcp`](./packages/variant-mcp) — MCP tools for variant lifecycle
  operations.
- [`variant-ui`](./packages/variant-ui) — the variants React app for the editor
  webview and the browser.
- [`variant-server`](./packages/variant-server) — the local web server behind
  `variant ui`; bundled into `variant-cli` and its executables, not a program of its own.
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
