## Why

Core lists `init` under *Other commands*, though it is the first command a new project runs. And `variant.seed` is a second spelling of what the `seed` step already does, so the docs and the schema describe one thing twice.

## What Changes

- **`init` first.** In the Core guide, `init` becomes the first heading of *Lifecycle commands*, before `create`. *Other commands* starts with `config`. The `core#init` deep link stays valid.
- **BREAKING: `variant.seed` is removed.** The schema, the loader, provisioning, the schema file, the example, the READMEs and the guides drop it. A seed is the step named `seed` (`variant.steps.seed.cmd`). A leftover `variant.seed` loads like any unknown key: one warning names it.
- **Overview.** The `More details at Core …` sentence of a command step is the last line of that step's paragraph, not a paragraph of its own.
- **Chat Renamer.** The Chat Renamer sidebar entry *Overview* is renamed *Extension*, and the page is titled *Chat Renamer Extension*.
- **Palette Commands.** Both extension pages get a *Palette Commands* section that describes every command in the palette.
- **Workspace page.** A last page of the Variant Worktrees group, *Workspace*, shows an ASCII tree of an ideal workspace rooted at `vw` and explains why it looks that way.
- **Site layout.** The docs directories match the sidebar: `index.md` is Getting Started (the old landing page and the top-right *Guide* link go), `guide/` holds the Variant Worktrees pages, `vscode/` the Extension, MCP server and Socket IPC pages, `chat-renamer/` and `development/` stay. *Core* is renamed *Commands*, and a new `guide/cli.md` takes the CLI-specific content (slug, global flags, completions). `cli-vscode-webview` is removed and its command definitions move to the library page.
- **BREAKING: no API reference.** The generated TypeDoc reference, its sidebar entry, `docs:api` and the TypeDoc dependencies are removed.
- **Installation.** The extension comes first, with links to the Visual Studio Marketplace and Open VSX; the mise CLI follows.
- **Chat Renamer.** The note on the `Variant:` titles of the two commands moves below the list.
- **Configuration.** The `db.multi` section links to the Overview heading *Custom multi-tenancy steps*.

## Capabilities

### New Capabilities

### Modified Capabilities

- `docs/site`: Core lists `init` first under *Lifecycle commands*; the Overview no longer links to `variant.seed`, and its `More details` sentence joins the paragraph before it; `db.multi` links to *Custom multi-tenancy steps*; the sidebar gains *Workspace*; both extension pages list their palette commands.
- `docs/readmes`: `seed` in configuration examples is a step.
- `variant-config/core`: the `variant.seed` requirement is removed; the `config` origin-comment scenario uses `variant.baseBranch`.
- `variant-api/provisioning`: provisioning order ends with the steps.

## Impact

- `packages/variant-config` (`schema.ts`, generated `variants.yaml.schema.json`, `variants.example.yaml`), `packages/variant-api/src/provisioning.ts`, and the specs of those packages and of `variant-cli`, `variant-mcp`.
- `example/variants.yaml` moves its seed into a `seed` step.
- `README.md`, `packages/variant-vscode/README.md`, `AGENTS.md`, `docs/` pages (moved and renamed), `CONTRIBUTING.md`, the READMEs' site links, and `scripts/docs-site.spec.ts`.
