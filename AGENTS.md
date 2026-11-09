## Workspace structure

The workspace is most likely set up like this:

```
<root>/
  _v-feature-one/
  _v-feature-42/
  variant-worktrees/ # main git checkout
  .agents -> variant-worktrees/.agents/
  AGENTS.md -> variant-worktrees/AGENTS.md
  CONTRIBUTING.md -> variant-worktrees/CONTRIBUTING.md
```

Do not read AGENTS.md + CONTRIBUTING.md twice.

## Contributor source-of-truth map

Read the narrowest authoritative source for the question at hand:

- `openspec/specs/` — current observable product requirements.
- `openspec/changes/` — proposed behavior, design decisions, and active tasks.
- `docs/` — VitePress user docs (library + MCP); not a behavior spec.
- `CONTRIBUTING.md` — TDD, test commands, coding workflow, and human review.

## Project overview

Bun workspace monorepo in `packages/`:

- `chat-renamer-api` — Cursor chat rename requests: pattern match, title numbering, hook text, and the agent-host call.
- `chat-renamer-config` — defaults and field schemas for chat renamer options, shared with `variant-config`.
- `chat-renamer-vscode` — Cursor extension (npm name `chat-renamer`) that renames a chat from its first prompt.
- `variant-api` — TypeScript database variant lifecycle library for Node.js and Bun.
- `variant-cli` — the `variant` command: argument parsing, help, and text/JSON/YAML output.
- `variant-config` — shared `variants.yaml` parser and mise/env autodetection.
- `variant-ipc` — Unix socket the VS Code extension hosts for editor requests. Lifecycle commands stay in `variant-api`.
- `variant-log` — shared log events and the process sink used by the library, CLI, MCP, and the editor socket.
- `variant-mcp` — MCP server exposing variant lifecycle tools.
- `variant-server` — loopback HTTP server (token, SSE, static app) behind `variant ui`. A library, not a binary: `variant-cli` bundles it, with the built app, into its package and executables.
- `variant-ui` — the variants React app (one UI for the editor webview and the browser) and its transport seam.
- `variant-vscode` — VS Code extension in the same workspace, included in the root build. Embeds chat-renamer.

Most variant commands run in `variant-api`. The CLI and the MCP server call that core logic in-process. Only requests that need the editor go over the Unix socket the VS Code extension hosts, and that socket refuses every lifecycle command. The extension's own views (the Variants view and the panel) call `variant-api` in-process for `list`, `watch`, `down` and `implode`; those calls are not reachable from the socket. Do not route the rest through the extension.

Tech: Bun, TypeScript strict ESM, Zod v4, Drizzle ORM, Biome, VitePress + TypeDoc. Database connection settings autodetect from `mise.local.toml`, then environment variables.

## Command execution

**All commands** and project tools (`openspec`, `task`, `bun`, `hk`, `commitlint`, etc)
should use mise-managed versions.
**AI agents** run `cd path/to/folder && eval "$(mise hook-env -s bash; set -x)";` at start of each shell series.
This will set all relevant env vars, including $PATH. Then `-x` echos, so no need for `echo '---what---'`. The `mise x --` prefix is a shorthand for this.
**Humans** with `eval "$(mise activate bash)"` in shell rc: run directly.
Tasks: `task <name>` at repo root. Root `package.json` is the Bun workspace; do not treat `bun run` as the agent CLI.
No mise? `/opt/homebrew/bin/mise`.
Override env vars: `mise x -- env FOO=bar bash -c 'echo $FOO'`

## Variants

Configured at [variants.yaml](variants.yaml).

- `variant create -s $slug [--from {branch}] [--pull-ff] [--mise-install=bg|sync|no]` creates the feature worktree and its state. Omit `--from` to start at `variant.baseBranch`. `--pull-ff` fast-forwards that start branch before a new variant branch is created. `--mise-install` defaults to `bg`: when the worktree has a Mise config, `create` runs `mise trust --all` and `mise install` in the background. Schema creation is `provision`.
- `variant provision` creates the schema and runs install, env, up, and seed. Creates the worktree when it is missing.
- `variant watch [--detach] [--reprovision]` runs the watches on the host when UI or tests need them. Creates and provisions when those are missing. `--reprovision` drops the schemas before provisioning again.
- `variant down` stops the watches and containers and leaves schemas, data, and the worktree.
- `variant deprovision` stops the watches and drops that slug's schemas. The worktree stays.
- `variant implode [--force] [--branch-rm=yes|no]` deprovisions, drops storage, and removes the worktree when the branch is merged, then removes the local branch. `--branch-rm=no` keeps it. The default is `yes`. `--force` only when the user explicitly allows it.

Ports, pids, URLs are in `{worktree}/.cache/variant/state.yaml`. Logs in `{worktree}/.cache/variant/watch.log`.

## Using hk from a coding agent

Inspect and plan before running. Scope checks to changed files with
`--files0-from` and use `--cd` to select the project root. Prefer `--safe`,
inspect command effects, and require approval for unknown or destructive
commands. Consume JSON or JSONL diagnostics while retaining raw output, and
always review the diff produced by a fix. MCP clients should use
`inspect_project`, `plan`, safe run tools, paged output, and `get_diff` rather
than invoking arbitrary shell commands.

```bash
mise x -- task check:changed
mise x -- hk fix --unstaged
mise x -- task check:all
mise x -- task check:full
```

Resolve behavioral conflicts by observable runtime/deployed contracts, then
automated tests, application code, and finally historical prose.

## Continuous integration

GitHub Actions in `.github/workflows/`. Prefer `task <name>` over raw `bun run`
when adding or changing gates. Do not merge PRs as an agent; human reviewer owns merge.

## File structure

```text
packages/
  variant-api/
    src/
      index.ts       — createClient() and lifecycle operations
      commands.ts    — command definitions shared by CLI/MCP
      db/             — Drizzle-backed database adapters
      operations/     — create/implode/up/down/watch/list/provision
      state.ts        — YAML variant state
      slug.ts         — explicit and git-derived slug resolution
      worktree.ts     — _v-* worktree management
  variant-cli/
    src/cli.ts        — `variant` entry point (bin)
    src/output.ts     — text, JSON and YAML rendering of command results
  variant-config/
    src/              — variants.yaml schema and config autodetection
  variant-log/
    src/index.ts      — log levels, events, and the process sink
  variant-ipc/
    src/index.ts      — Unix socket for editor requests
  variant-mcp/
    src/mcp.ts        — MCP server entry point
    src/mcp.spec.ts   — MCP server tests
  variant-ui/
    src/              — React app, transports (memory, HTTP, webview messages), sibling *.spec.ts; helpers such as setup.ts live in src/test
  variant-server/
    src/              — HTTP API, event stream, static files, `variant ui` core
  variant-vscode/    — VS Code extension (workspace member and root build target)
  chat-renamer-config/
    src/              — chat renamer defaults and field schemas
  chat-renamer-api/
    src/              — rename request parsing, numbering, hooks, agent-host call, awake
  chat-renamer-vscode/ — Cursor extension (npm name `chat-renamer`)
docs/                — VitePress documentation
```
