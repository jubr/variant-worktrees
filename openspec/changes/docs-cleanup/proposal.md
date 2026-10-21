## Why

The GitHub Pages project site serves the VitePress build under the repository path, but the site is built with base `/`. Stylesheets, favicons, and the product logo are requested at the domain root, so they 404 and the published pages render as unstyled HTML. A fixed remote statue still loads in the corner, and the doc chrome does not match a normal dark reference layout (sidebar, search, outline, copyable code).

## What Changes

- Build the docs site with a base path equal to the GitHub Pages project path so styles, favicons, and the product logo resolve on the published site.
- Present guide, MCP, API, and the landing page in a dark VitePress doc shell: left sidebar, top navigation with the product logo and local search, right-hand outline, and fenced code with a copy control. The appearance toggle stays, and the initial appearance is dark. The accent stays the existing terracotta brand color.
- Remove the fixed corner statue and every `zach.dev` reference from `docs/`.
- Stop opting the landing page out of the sidebar.

## Capabilities

### New Capabilities

- `docs/site`: the published VitePress site loads its own styles and product logo, uses the dark doc shell, and does not embed the remote statue or link to `zach.dev`.

### Modified Capabilities

None. `variant-vscode/product-icon` already requires the 256×256 icon as the nav logo and the 32 and 16 pixel icons as favicons. This change does not alter those pixels or that requirement.

## Impact

- `docs/.vitepress/config.ts` (`base`, appearance, search, sidebar on the landing page).
- `docs/.vitepress/theme/` (layout slot, homepage, custom CSS).
- `docs/index.md` landing layout.
- The GitHub Pages artifact produced by the existing docs workflow. The workflow file stays as it is.
- Local `task docs:dev` and `vitepress preview` serve under the same base path as Pages.

## Non-goals

- Rewrite guide or MCP prose.
- Change icon artwork, sizes, or the extension manifest.
- Copy another documentation site's palette, wordmark, or section names.
- Add a repository social-preview image in GitHub settings.
- Introduce a custom domain.
