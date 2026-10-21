## Context

See proposal.md for why. The docs workflow uploads `docs/.vitepress/dist` and GitHub Pages serves that directory at `/variant-worktrees/`. `docs/.vitepress/config.ts` sets `base: "/"`, so the built HTML requests `/assets/…` and `/logo-256.png` at the host root. Those files exist inside the artifact and 404 at the root. Favicon `<link>` tags in `head` are copied into the HTML as written; VitePress prefixes stylesheets, module scripts, and the theme logo with `base`, but it does not prefix custom `head` hrefs.

The theme extends the default theme, then replaces the layout to inject a fixed remote image and replaces the home page with `layout: page` and `sidebar: false`. `packages/variant-vscode/src/product-icon.spec.ts` asserts `themeConfig.logo` is `/logo-256.png` and the favicon head hrefs are `/favicon-32.png` and `/favicon-16.png`.

## Goals / Non-Goals

**Goals:**

- One `base` for dev, preview, and Pages.
- Keep the product-icon assertions on logo and favicon config strings green.
- Use the default document chrome (sidebar, local search, outline, code copy, appearance toggle) with the existing terracotta accent on a dark navy page.
- Remove the custom layout slot and the sidebar-less home.

**Non-Goals:**

- Code-group tabs on the installation page.
- A different sidebar per section.
- Editing the docs workflow.

## Decisions

### Base path is always `/variant-worktrees/`

Set `base` to `/variant-worktrees/` in the VitePress config for every command. Dev and preview then use the same prefix as Pages.

Alternative: set `base` only in CI. Rejected because local preview would keep serving assets at `/` and would not catch a broken prefix.

Alternative: `base: "./"` so asset URLs are relative. Rejected because the markdown and nav already use root-absolute links (`/guide/`, `/api/`), which VitePress rewrites from an absolute `base`.

### Prefix custom head links at render time

Add `transformHead` that prefixes root-relative `href` and `src` values with the site base. Leave the favicon hrefs and `themeConfig.logo` unchanged so the product-icon test still sees `/favicon-32.png`, `/favicon-16.png`, and `/logo-256.png`. The default theme already applies `base` to the logo when it renders.

Do not prefix external URLs or protocol-relative URLs. The font stylesheet stays on the font host.

### Dark default with the toggle kept

Set `appearance` to `'dark'`. That stores dark as the fallback and still renders the toggle. `'force-dark'` would remove the toggle, so it is rejected.

### One sidebar, local search, default code chrome

Replace the three sidebar maps with one sidebar shown on every page:

- Getting Started: Introduction (`/guide/`), Installation, Library, Replacing shell scripts, Editor socket, MCP Server
- Reference: API Reference (`/api/`)

Enable local search. Keep the existing top nav and GitHub social link. Do not add installation tabs; the default fenced-code header and copy control are the code chrome.

### Landing page is a document

Remove `layout: page`, `sidebar: false`, and the custom home component. Write the current landing sentences (version line, tagline, `npm install variant-api`, links to the guide and the API reference, the library blurb, the MCP blurb) as a normal document so they sit in the sidebar shell. Delete the home component and the layout override once nothing imports them. Keep `custom.css`.

### Palette

Keep the light tokens already in `custom.css` (`#FAFAF8` page, `#C45D3E` accent). In the dark scheme set the page background to `#12151c` and keep the accent at `#C45D3E`. Do not adopt the reference site's green.

Delete the fixed-footer rules with the layout slot.

## Risks / Trade-offs

- [Repo rename or a user-site move] → `base` would be wrong until config changes. The path matches the repository name Pages already uses.
- [Root-absolute links that VitePress does not rewrite] → check built guide, MCP, and API anchors after `task docs:build`.
- [`transformHead` double-prefix] → prefix only href/src values that start with a single `/` and do not already start with the base.
- [Docs build inside the site test] → `task docs:build` generates the API reference and is slower than a config assertion. The asset and attribution checks need the built HTML, so the cost stays.

## Migration Plan

1. Land the config, theme, landing page, and site test on `main`.
2. The existing docs workflow publishes the new artifact. No workflow edit.
3. Rollback is reverting that commit and re-running the docs workflow. The previous artifact returns. No data migration.
