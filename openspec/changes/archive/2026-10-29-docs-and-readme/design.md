## Context

See proposal.md for motivation. Constraints:

- The package README is packaged into the `.vsix` (`.vscodeignore` whitelists `README.md`, `media/icon-256.png`). The Marketplace and Open VSX render it, so links to repository files and the docs must be absolute URLs; relative `../../docs` links break there.
- `packages/variant-vscode/src/product-icon.spec.ts` requires the repository README to show `icon-256.png`.
- The published docs live on GitHub Pages under `https://jubr.github.io/variant-worktrees/` (VitePress base `/variant-worktrees/`).
- `docs/` is the detailed source (guide index, core, configuration, MCP, chat renamer). READMEs are the short, narrative front door.

## Goals / Non-Goals

**Goals:**

- One shared story for both READMEs: why, then how, then what you can configure and connect.
- Content picked from `docs/`, linking to the matching docs page for depth.
- A test that pins the observable README and manifest contract.

**Non-Goals:**

- A generated README or a shared include. The two files differ in audience and are written by hand.
- Restating every CLI flag or config option in a README.

## Decisions

- **Story order**: `Why` → `How it works` (human and agent flow with `create`/`watch`/`implode`) → `Configure` (short `variants.yaml`) → `Use it from an agent` (MCP) → `Chat renamer` → `Learn more`. The extension README opens with the extension tagline; the repository README keeps the icon, packages list, and a short `Contributing` pointer. Alternative: reuse `docs/guide/index.md` verbatim — rejected, it starts with a definition rather than a motivation.
- **Docs link placement**: a single bold line directly under the title, above `## Why`, absolute URL. Alternative: a badge — rejected, badges rely on external image hosts that the Marketplace sanitizer can block.
- **Extension README drops the command probe and the long chat-renamer option inventory**: the probe is a diagnostic aid and the option list is reference material that belongs in `docs/chat-renamer`. The README keeps the slash command, activation patterns, and one link to the docs.
- **CLI version source**: `cli.ts` statically imports `../package.json` (`with { type: "json" }`) so `bun build --compile` embeds it. Alternative: `createRequire(...)("../package.json")`, as `variant-mcp` does — rejected, it fails inside the compiled executable (`Cannot find module '../package.json'`).
- **Test**: a colocated `readme.spec.ts` in `packages/variant-vscode/src/` reads `README.md`, `packages/variant-vscode/README.md`, and the manifest, as `product-icon.spec.ts` already does for the icon.

## Risks / Trade-offs

- [README and `docs/` drift] → READMEs stay short and link to docs for detail; the test pins only structure.
- [Absolute docs URL breaks if the Pages base changes] → the docs site spec already fixes the `/variant-worktrees/` prefix.
