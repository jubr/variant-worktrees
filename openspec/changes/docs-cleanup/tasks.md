## 1. Published asset URLs

- [ ] 1.1 Add a failing `scripts/docs-site.spec.ts` (`bun test scripts/docs-site.spec.ts`) for [specs/docs/site | Published asset URLs](../../specs/docs/site/spec.md#requirement-published-asset-urls). Assert the site config keeps logo `/logo-256.png` and favicon hrefs `/favicon-32.png` and `/favicon-16.png`, sets base `/variant-worktrees/`, and that `task docs:build` emits a home page whose stylesheet, script, favicon, and navigation logo URLs start with `/variant-worktrees/` and whose stripped paths exist in the build output. Verify the test fails before the config change.

- [ ] 1.2 Set base to `/variant-worktrees/` and prefix root-relative head `href`/`src` values in `transformHead`, leaving external URLs and the product-icon logo and favicon strings unchanged. Verify `bun test scripts/docs-site.spec.ts` and `packages/variant-vscode/src/product-icon.spec.ts` pass.

## 2. Dark document shell

- [ ] 2.1 Extend `scripts/docs-site.spec.ts` with failing assertions for [specs/docs/site | Dark document shell](../../specs/docs/site/spec.md#requirement-dark-document-shell), [specs/docs/site | Top navigation](../../specs/docs/site/spec.md#requirement-top-navigation), and [specs/docs/site | Landing page uses the document shell](../../specs/docs/site/spec.md#requirement-landing-page-uses-the-document-shell): the built installation page has a sidebar, search, navigation logo, heading outline, fenced-code copy control, and a dark/light switch; with no stored preference the page selects dark; the built stylesheet sets the dark page background to `#141414` and the brand accent to `#EC0000`; the top navigation has Guide, Configuration, CLI, and MCP pointing at the guide introduction, the library configuration section, the CLI command documentation, and the MCP server page; it links to `https://github.com/jubr/variant-worktrees`; it shows `v` plus the root `package.json` version and that version links to `https://github.com/jubr/variant-worktrees/releases`; the built home page includes the sidebar and navigation logo. Verify the new assertions fail first.

- [ ] 2.2 Apply the design: `appearance: 'dark'`, local search, one sidebar (Getting Started plus Reference), top navigation from the design table with the version read from the root `package.json`, landing copy moved into a normal document, custom home component and layout override removed, dark page background `#141414`, accent `#EC0000`, neutral light and dark surfaces from the design palette. Verify `bun test scripts/docs-site.spec.ts` passes.

## 3. Remote attribution

- [ ] 3.1 Extend `scripts/docs-site.spec.ts` with failing assertions for [specs/docs/site | No remote personal-site attribution](../../specs/docs/site/spec.md#requirement-no-remote-personal-site-attribution): tracked files under `docs/` and the built home page omit the host and image name that requirement forbids, and the built home page has no fixed corner image. Verify the new assertions fail first.

- [ ] 3.2 Remove the fixed corner image, the layout slot that renders it, and its CSS. Verify `bun test scripts/docs-site.spec.ts` passes.

## 4. Validation

- [ ] 4.1 Run `task docs:build`, `bun test scripts/docs-site.spec.ts`, `bun test packages/variant-vscode/src/product-icon.spec.ts`, and `openspec validate --all --strict --no-interactive`. Verify each passes. Confirm built guide, MCP, and API links include the `/variant-worktrees/` prefix.
