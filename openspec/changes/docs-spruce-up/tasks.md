## 1. QA tests first

- [ ] 1.1 In `scripts/docs-site.spec.ts` add failing tests for [specs/docs/site | Configuration page structure](../../specs/docs/site/spec.md#requirement-configuration-page-structure): every key of `variant` in `packages/variant-config/variants.yaml.schema.json` has a `variant.<key>` heading in the built Configuration page, those headings are in alphabetical order, and the second-level headings start with Options, then Templates, and end with Unknown keys and migration. Verify they fail first.
- [ ] 1.2 Add failing tests for [specs/docs/site | Installation into an existing project](../../specs/docs/site/spec.md#requirement-installation-into-an-existing-project), [Runtime page](../../specs/docs/site/spec.md#requirement-runtime-page), [Extension page](../../specs/docs/site/spec.md#requirement-extension-page), [Library page shows code](../../specs/docs/site/spec.md#requirement-library-page-shows-code) [Cross-links into the VSCode / Cursor group](../../specs/docs/site/spec.md#requirement-cross-links-into-the-vscode-cursor-group) and the extended [Sidebar groups](../../specs/docs/site/spec.md#requirement-sidebar-groups) order. Verify they fail first.

## 2. Pages

- [ ] 2.1 Rewrite `docs/guide/installation.md` (mise flavor, extension flavor, link to Development, no npm commands). Move library and MCP installation into `docs/development/building.md` (or a sibling Development page) and fix `docs/index.md` and `docs/guide/core.md` wording that names npm.
- [ ] 2.2 Create `docs/guide/runtime.md` from the Runtime, Environment through Mise, Environment variables and When watches are omitted sections of the Configuration page, tailored to watches; fix inbound links.
- [ ] 2.3 Create `docs/guide/extension.md` documenting `variant-vscode` from the extension README and specs (Variants view, panel, Onboarding, MCP registration, chat renamer).
- [ ] 2.4 Reshape `docs/guide/library.md` into code examples with links into Core.
- [ ] 2.5 Reorder `docs/guide/configuration.md`: Options with one `variant.<key>` heading each, alphabetical; then the other option sections, Templates, and Unknown keys and migration last.
- [ ] 2.6 Update the sidebar in `docs/.vitepress/config.ts`: new group VSCode / Cursor (Extension, MCP Server, Socket IPC) below Variant Worktrees.
- [ ] 2.7 Add the cross-links of the spec to Getting Started, Installation, Core, Configuration, Runtime, Library, and back from the Extension, MCP Server and Socket IPC pages (`docs/mcp.md`, `docs/guide/socket-ipc.md`). Verify `bun test scripts/docs-site.spec.ts` passes.

## 3. Wrap up

- [ ] 3.1 Add a `CHANGELOG.md` entry under Unreleased.
- [ ] 3.2 Run `openspec validate --all --strict --no-interactive` and `task check:full`.
