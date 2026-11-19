## 1. `init` first in Core

- [ ] 1.1 Test: `scripts/docs-site.spec.ts` expects `init` first below *Lifecycle commands* and `config` first below *Other commands*
- [ ] 1.2 Move the `init` section of `docs/guide/core.md` to the start of *Lifecycle commands*; fix the intro text of both groups
- [ ] 1.3 Check the README CLI section and `docs/mcp.md` list `init` first among the commands

## 2. Overview and Configuration links

- [ ] 2.1 Test: in `scripts/docs-site.spec.ts` the `More details at Core` sentence is the end of the single paragraph of each command step; the `db.multi` section links to `/guide/overview#custom-multi-tenancy-steps`
- [ ] 2.2 Join each `More details at Core …` line of `docs/guide/overview.md` to the paragraph above it; add the link to the `db.multi` section of `docs/guide/configuration.md`

## 3. Remove `variant.seed`

- [ ] 3.1 Tests: `schema`, `provisioning`, `command-echo`, `project-dir`, `provision`, `mise`, `mise-bun`, `environment`, `prefix`, `chat-renamer-section`, `legacy`, `options`, `config-text`, `mcp` and `docs-site` specs use a `seed` step instead of `variant.seed`; a leftover `variant.seed` warns
- [ ] 3.2 Drop `seed` from the `variant` schema and from `provisioning.ts`; regenerate `variants.yaml.schema.json`
- [ ] 3.3 Replace `seed:` in `variants.example.yaml`, `example/variants.yaml`, `README.md`, `packages/variant-vscode/README.md` and `AGENTS.md` with the step form or plain wording
- [ ] 3.4 Remove the `variant.seed` heading and links in `docs/guide/*` and `docs/mcp.md`

## 4. Verify

- [ ] 4.1 `task check:full`, `openspec validate --all --strict --no-interactive`
- [ ] 4.2 `task bleed:cli` and show the bled `variant` rejecting a `variant.seed` with a warning
