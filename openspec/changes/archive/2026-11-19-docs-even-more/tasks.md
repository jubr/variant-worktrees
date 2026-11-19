## 1. `init` first in Core

- [x] 1.1 Run the docs site test, which does not pin the position of `init`
- [x] 1.2 Move the `init` section of `docs/guide/core.md` to the start of *Lifecycle commands*; fix the intro text of both groups
- [x] 1.3 Check the README CLI section and `docs/mcp.md` list `init` first among the commands

## 2. Overview and Configuration links

- [x] 2.1 Run the docs site test, which pins the Overview paragraph shape only through the link and word limit
- [x] 2.2 Join each `More details at Core …` line of `docs/guide/overview.md` to the paragraph above it; add the link to the `db.multi` section of `docs/guide/configuration.md`

## 3. Extension pages and Workspace

No tests for these; `task docs:build` runs after each edit.

- [x] 3.1 Rename the Chat Renamer sidebar entry *Overview* to *Extension* and the page title to *Chat Renamer Extension*; fix links and tests that name the old text
- [x] 3.2 Add *Palette Commands* to `docs/guide/extension.md` and `docs/chat-renamer/index.md`
- [x] 3.3 Add `docs/guide/workspace.md` with the `vw` tree and the reasoning; add it last to the Variant Worktrees sidebar group

## 4. Remove `variant.seed`

- [x] 4.1 Tests: `schema`, `provisioning`, `command-echo`, `project-dir`, `provision`, `mise`, `mise-bun`, `environment`, `prefix`, `chat-renamer-section`, `legacy`, `options`, `config-text`, `mcp` and `docs-site` specs use a `seed` step instead of `variant.seed`
- [x] 4.2 Drop `seed` from the `variant` schema and from `provisioning.ts`; regenerate `variants.yaml.schema.json`
- [x] 4.3 Replace `seed:` in `variants.example.yaml`, `example/variants.yaml`, `README.md`, `packages/variant-vscode/README.md` and `AGENTS.md` with the step form or plain wording
- [x] 4.4 Remove the `variant.seed` heading and links in `docs/guide/*` and `docs/mcp.md`

## 5. Restructure the docs

No new tests; the existing docs tests follow the moved pages.

- [x] 5.1 Move the pages into `guide/`, `vscode/`, `development/` and `index.md`; drop the *Guide* nav link and the old landing page; fix links
- [x] 5.2 Rename *Core* to *Commands*; add `guide/cli.md` with the CLI-specific content; move the command definitions to the library page; remove `cli-vscode-webview`
- [x] 5.3 Installation: extension first with Marketplace and Open VSX links, drop the building line; Chat Renamer palette note below the list
- [x] 5.4 Remove the API reference: the sidebar entry, TypeDoc and its scripts, the workflow step and the tests that read it

## 6. Verify

- [x] 6.1 `task check:full`, `openspec validate --all --strict --no-interactive`
- [ ] 6.2 `task bleed:cli` and show the bled `variant` rejecting a `variant.seed` with a warning
