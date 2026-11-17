## Context

This design covers the relocatable-site part of the change: the site hard-codes `/variant-worktrees/` in every asset URL (`base` plus a `transformHead` workaround in `docs/.vitepress/config.ts`), so the same build cannot be served from another path, a mirror, a shared folder or `file://`. VitePress 1.6.4 (latest stable) rejects a relative `base`; `vitepress@next` (2.0.0-alpha.21) accepts exactly `'./'` and documents it under *Relocatable Builds*. Current config: `base: "/variant-worktrees/"` plus `withPagesBase`, which prefixes root-absolute `head` hrefs.

## Goals / Non-Goals

- Goals: one build that works from any path, including GitHub Pages; keep the dark shell, sidebar and tests green.
- Non-Goals: supporting `cleanUrls`; supporting `404.html` at arbitrary depth (VitePress documents that limit).

## Decisions

- **Adopt the 2.0 alpha, pinned exactly (no caret).** Alternative: post-process HTML to rewrite `/variant-worktrees/` to `../` per depth. Rejected: the client router and site data still carry the absolute base, so it only looks relative. Risk: alpha churn; mitigated by the pin and by the existing docs-site tests, which build the whole site.
- **`head` favicons through `transformHead`.** `head` entries are emitted as written, so a relative `href` needs the page depth, which `transformHead` receives as `pageData.relativePath`. The config keeps `/favicon-32.png` and `/favicon-16.png` public paths as the source of truth; the emitted `href` is the relative form.
- **Navigation logo.** `themeConfig.logo` stays `/logo-256.png`. Whether VitePress rewrites it to a relative URL is checked by the new tests first; if it does not, the theme gets a relative path via `transformHtml` or the logo is imported as an asset.

## Risks / Trade-offs

- A 2.0 alpha may change before release: keep the pin, revisit at stable. Rollback is reverting the dependency and config.
- Hosts that canonicalize URLs differently (trailing slash on pages) break relative resolution; GitHub Pages serves canonical URLs.

## Open Questions

- Does the alpha build still need the `docs:api` TypeDoc output unchanged? Expected yes: it only writes markdown.
