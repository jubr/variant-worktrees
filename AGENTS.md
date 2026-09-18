# Contributor source-of-truth map

Read the narrowest authoritative source for the question at hand:

- `openspec/specs/` — current observable product requirements.
- `openspec/changes/` — proposed behavior, design decisions, and active tasks.
- `docs/` — VitePress user docs (library + MCP); not a behavior spec.
- `CONTRIBUTING.md` — TDD, test commands, coding workflow, and human review.

## Project overview

Bun workspace monorepo:

- **`variant-config`** — shared `variants.yaml` parser and mise/env autodetection.
- **`variant-api`** — TypeScript database variant lifecycle library and `variant` CLI.
- **`variant-mcp`** — MCP server exposing variant lifecycle tools.
- **`variant-vscode`** — VS Code extension in the same workspace, included in the root build.

Tech: Bun, TypeScript strict ESM, Zod v4, Drizzle ORM, Biome, VitePress + TypeDoc. Database connection settings autodetect from `mise.local.toml`, then environment variables.

## Command execution

**All commands** and project tools (`openspec`, `task`, `bun`, `hk`, `commitlint`, etc)
should use mise-managed versions.
**AI agents** run `cd path/to/folder && eval "$(mise hook-env -s bash)";` at start of each shell series.
This will set all relevant env vars, including $PATH. The `mise x --` prefix is a shorthand of this.
**Humans** with `eval "$(mise activate bash)"` in shell rc: run directly.
Tasks: `task <name>` at repo root. Root `package.json` is the Bun workspace; do not treat `bun run` as the agent CLI.
No mise? `/opt/homebrew/bin/mise`.
Override env vars: `mise x -- env FOO=bar bash -c 'echo $FOO'`

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
      operations/     — create/destroy/list/switch/provision
      state.ts        — YAML variant state
      slug.ts         — explicit and git-derived slug resolution
      worktree.ts     — _v-* worktree management
    test/
  variant-config/
    src/              — variants.yaml schema and config autodetection
    test/
  variant-mcp/
    src/mcp.ts       — MCP server entry point
    test/mcp.test.ts — MCP server tests
  variant-vscode/    — VS Code extension (workspace member and root build target)
docs/                — VitePress documentation
```
