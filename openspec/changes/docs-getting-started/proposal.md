## Why

A newcomer reads Getting Started, then Overview, and still has no path to a running variant: Installation is buried after Configuration, the Overview does not say where the flow starts, and the Overview ends in two long worked examples of custom steps instead of pointing on. Installation also repeats what `variant init` documents, never tells the reader to activate mise, and shows neither what `init` prints nor the `variants.yaml` it writes. The custom-step examples describe configuration, not the flow, and the page does not say in which order several steps around the same anchor run.

## What Changes

- **Overview.** The *Custom Steps* and *Custom multi-tenancy steps* sections leave the Overview. The Flow of Steps gains *Installation* as its first step, a short paragraph that links to the Installation page. The page ends with a section *Next steps*: natural sentences with deep links to the Workspace page, the Flow of Steps, the options of `variants.yaml`, the command-line commands, and more (the Extension, the MCP server, Runtime). `VARIANT_STEP_<STEP>=no` stays on the Overview, in its intro.
- **Configuration.** The two sections arrive as second-level sections, in this order, right before *Templates*: *Custom Steps*, then *Custom multi-tenancy steps*. *Custom Steps* adds that several steps with the same `runBefore` or `runAfter` run in the order they are written in `variants.yaml`, and that a step `custom1` with `runAfter: watch` makes `variant watch` run create, provision, seed, watch, custom1. The `db.multi` link and the `variant.steps` section follow.
- **Installation.** The page moves to directly after Overview in the sidebar. It no longer repeats what `init` does: it links to [`variant init`](docs/guide/commands.md#variant-init). The extension section is renamed *Extension for VSCode and Cursor*. The page is three steps: (1) install mise and activate it with `mise activate`; (2a) install the extension, which can run the init logic, or (2b) run `mise x packslip:jubr/variant-worktrees@latest -- variant init` in the project directory, with example output; (3) review `variants.yaml`, with an example.
- **Links.** The anchors `overview#custom-steps` and `overview#custom-multi-tenancy-steps` stop resolving; `configuration#custom-steps` and `configuration#custom-multi-tenancy-steps` replace them. Every internal link is updated.
- **BREAKING (docs URLs):** the two anchors above.

## Capabilities

### New Capabilities

### Modified Capabilities

- `docs/site`: sidebar order (Installation after Overview); Configuration holds the custom-step sections before Templates and explains their order; Overview starts with Installation, drops the custom-step sections and ends with *Next steps*; Installation is a three-step page that links to `variant init`; `db.multi` links to the Configuration section; site layout page order.
- `variant-api/multi-schema`: the guide requirement places *Custom Steps* and *Custom multi-tenancy steps* on the Configuration page.

## Impact

- `docs/guide/overview.md`, `configuration.md`, `installation.md`, `docs/.vitepress/config.ts` (sidebar), and links in `docs/index.md`, `docs/vscode/extension.md` and other pages that point at Installation or the moved anchors.
- `scripts/docs-site.spec.ts` (and `scripts/docs-coverage.spec.ts` if it reads the moved sections).
- `CHANGELOG.md` *Unreleased*; `README.md` only where it names these anchors.
- No product code.
