## 1. QA tests first

- [x] 1.1 In `scripts/docs-site.spec.ts` add failing tests for [specs/docs/site | Configuration page structure](../../specs/docs/site/spec.md#requirement-configuration-page-structure): every key of `variant` in `packages/variant-config/variants.yaml.schema.json` has a `variant.<key>` heading in the built Configuration page, those headings are in alphabetical order, and the second-level headings start with Options, then Templates, and end with Unknown keys and migration. Verify they fail first.
- [x] 1.2 Add failing tests for [specs/docs/site | Installation into an existing project](../../specs/docs/site/spec.md#requirement-installation-into-an-existing-project), [Runtime page](../../specs/docs/site/spec.md#requirement-runtime-page), [Extension page](../../specs/docs/site/spec.md#requirement-extension-page), [Library page shows code](../../specs/docs/site/spec.md#requirement-library-page-shows-code) [Cross-links into the VSCode / Cursor group](../../specs/docs/site/spec.md#requirement-cross-links-into-the-vscode-cursor-group) and the extended [Sidebar groups](../../specs/docs/site/spec.md#requirement-sidebar-groups) order. Verify they fail first.

## 2. Pages

- [x] 2.1 Rewrite `docs/guide/installation.md` (mise flavor, extension flavor, link to Development, no npm commands). Move library and MCP installation into `docs/development/building.md` (or a sibling Development page) and fix `docs/index.md` and `docs/guide/core.md` wording that names npm.
- [x] 2.2 Create `docs/guide/runtime.md` from the Runtime, Environment through Mise, Environment variables and When watches are omitted sections of the Configuration page, tailored to watches; fix inbound links.
- [x] 2.3 Create `docs/guide/extension.md` documenting `variant-vscode` from the extension README and specs (Variants view, panel, Onboarding, MCP registration, chat renamer).
- [x] 2.4 Reshape `docs/guide/library.md` into code examples with links into Core.
- [x] 2.5 Reorder `docs/guide/configuration.md`: Options with one `variant.<key>` heading each, alphabetical; then the other option sections, Templates, and Unknown keys and migration last.
- [x] 2.6 Update the sidebar in `docs/.vitepress/config.ts`: new group VSCode / Cursor (Extension, MCP Server, Socket IPC) below Variant Worktrees.
- [x] 2.7 Add the cross-links of the spec to Getting Started, Installation, Core, Configuration, Runtime, Library, and back from the Extension, MCP Server and Socket IPC pages (`docs/mcp.md`, `docs/guide/socket-ipc.md`). Verify `bun test scripts/docs-site.spec.ts` passes.

## 3. Relative base

- [x] 3.1 In `scripts/docs-site.spec.ts` replace the two *published asset URLs* tests with failing ones for [specs/docs/site | Relocatable asset URLs](../../specs/docs/site/spec.md#requirement-relocatable-asset-urls): the home page and `guide/installation.html` request stylesheet, script, favicon and logo URLs that do not start with `/`, none contains `/variant-worktrees/`, each resolves against its page to a file in `dist/`; the configuration has `base: "./"`, logo `/logo-256.png`, and `cleanUrls` off. Verify they fail first.
- [x] 3.2 Pin `vitepress` to `2.0.0-alpha.21` (exact) in `package.json`, update `bun.lock`, and make `task docs:build` pass.
- [x] 3.3 Set `base: "./"` in `docs/.vitepress/config.ts`, drop `withPagesBase`, and emit relative favicon links with `transformHead`. If the navigation logo is still root-absolute, make it relative as the design says. Verify `bun test scripts/docs-site.spec.ts` passes, including the sidebar and cross-link tests of group 1 and 2.
- [x] 3.4 Serve `docs/.vitepress/dist` from a sub path other than `/variant-worktrees/` and confirm in the browser that a nested page loads its styles and the navigation works. Report the observation in chat.

## 4. Outline

- [ ] 4.1 In `scripts/docs-site.spec.ts` add a failing test for [specs/docs/site | Dark document shell](../../specs/docs/site/spec.md#requirement-dark-document-shell): the outline of the built Configuration page links to `variant.abbr` and to Templates. Verify it fails first.
- [ ] 4.2 Set `themeConfig.outline` to levels 2 and 3 in `docs/.vitepress/config.ts`. Verify `bun test scripts/docs-site.spec.ts` passes.

## 5. Wrap up

- [ ] 5.1 Add a `CHANGELOG.md` entry under Unreleased.
- [ ] 5.2 Run `openspec validate --all --strict --no-interactive` and `task check:full`.
