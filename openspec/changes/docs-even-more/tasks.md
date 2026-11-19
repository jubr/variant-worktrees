## 1. `init` first in Core

- [ ] 1.1 Run the docs site test, which does not pin the position of `init`
- [ ] 1.2 Move the `init` section of `docs/guide/core.md` to the start of *Lifecycle commands*; fix the intro text of both groups
- [ ] 1.3 Check the README CLI section and `docs/mcp.md` list `init` first among the commands

## 2. Overview and Configuration links

- [ ] 2.1 Run the docs site test, which pins the Overview paragraph shape only through the link and word limit
- [ ] 2.2 Join each `More details at Core …` line of `docs/guide/overview.md` to the paragraph above it; add the link to the `db.multi` section of `docs/guide/configuration.md`

## 3. Extension pages and Workspace

No tests for these; `task docs:build` runs after each edit.

- [ ] 3.1 Rename the Chat Renamer sidebar entry *Overview* to *Extension* and the page title to *Chat Renamer Extension*; fix links and tests that name the old text
- [ ] 3.2 Add *Palette Commands* to `docs/guide/extension.md` and `docs/chat-renamer/index.md`
- [ ] 3.3 Add `docs/guide/workspace.md` with the `vw` tree and the reasoning; add it last to the Variant Worktrees sidebar group

## 4. Remove `variant.seed`

- [ ] 4.1 Tests: `schema`, `provisioning`, `command-echo`, `project-dir`, `provision`, `mise`, `mise-bun`, `environment`, `prefix`, `chat-renamer-section`, `legacy`, `options`, `config-text`, `mcp` and `docs-site` specs use a `seed` step instead of `variant.seed`
- [ ] 4.2 Drop `seed` from the `variant` schema and from `provisioning.ts`; regenerate `variants.yaml.schema.json`
- [ ] 4.3 Replace `seed:` in `variants.example.yaml`, `example/variants.yaml`, `README.md`, `packages/variant-vscode/README.md` and `AGENTS.md` with the step form or plain wording
- [ ] 4.4 Remove the `variant.seed` heading and links in `docs/guide/*` and `docs/mcp.md`

## 5. Verify

- [ ] 5.1 `task check:full`, `openspec validate --all --strict --no-interactive`
- [ ] 5.2 `task bleed:cli` and show the bled `variant` rejecting a `variant.seed` with a warning
