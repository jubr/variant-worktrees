## Why

variant-worktrees has no product icon. The VS Code extension manifest has no `icon`, the docs site has no logo or favicon, and the repository README has no mark, so the extension and the docs are indistinguishable from an unbranded scaffold.

## What Changes

- Adopt the supplied square artwork (red branch badge over a color-swatch fan, 375×374 PNG at `assets/source.png` in this change) as the variant-worktrees icon.
- Produce downscaled PNGs at the sizes the current surfaces actually use: 256, 128, 32, and 16.
- Mask each PNG to a rounded rectangle whose corner radius is one fifth of the side. Pixels outside that rounded rectangle are fully transparent.
- Point the `variant-vscode` extension manifest at the 256×256 PNG and include that file in the packaged extension.
- Use the same artwork for the VitePress nav logo and favicon, and show the 256×256 PNG in the repository README.

## Capabilities

### New Capabilities

- `variant-vscode/product-icon`: the extension manifest, packaged extension, docs site, and repository README present the supplied artwork at the required pixel sizes.

### Modified Capabilities

None.

## Impact

- `packages/variant-vscode/package.json` (`icon`, and the `files` list so the icon is inside the vsix).
- New PNGs under `packages/variant-vscode/media/` and `docs/public/`.
- `docs/.vitepress/config.ts` logo and favicon links.
- Root `README.md` mark.
- A stable copy of the source PNG in the repo so the sizes can be regenerated.
- A test that checks the manifest path and the PNG dimensions.

## Non-goals

- Rebrand `chat-renamer-vscode` (separate display name, no icon of its own today).
- Draw a monochrome activity-bar icon. The extension contributes no view container.
- Upscale past the source (no 512) or redraw the artwork as SVG.
- Set a GitHub social preview image. That lives in repository settings, not in the tree.
