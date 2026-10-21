## Why

`chat-renamer-vscode` has no product icon. The extension manifest, the packaged extension, and the package README show no mark, so Marketplace and the editor list it as an unbranded extension. The only brand source in the repo is `assets/brand/source.png`, which is the variant-worktrees artwork, so a second picture cannot be added without taking that file's name.

## What Changes

- Rename `assets/brand/source.png` to `assets/brand/variant-worktrees.png`. Variant-worktrees icons, the docs logo, favicons, and the repository README mark stay the same picture.
- Adopt the supplied chat-renamer artwork (cube and "NAME" speech bubble, 218×218 PNG with alpha, at `assets/chat-renamer.png` in this change) as `assets/brand/chat-renamer.png`.
- Publish one square downscale for chat-renamer with the same mask as variant-worktrees: rounded rectangle flush with the icon sides, corner radius one tenth of the side, pixels outside fully transparent. Center-crop, then lanczos3. Do not upscale.
- The source is 218×218, so 256 would be an upscale. The extension icon is 128×128, the largest size variant-worktrees publishes that is still a downscale, and the smallest size VS Code accepts.
- Point the `chat-renamer-vscode` manifest at that PNG, include it in the packaged extension, and show it in the package README.

## Capabilities

### New Capabilities

- `chat-renamer-vscode/product-icon`: the extension manifest, packaged extension, and package README present the supplied artwork at 128×128.

### Modified Capabilities

None. Renaming the variant-worktrees source file does not change the pixels or the surfaces in `variant-vscode/product-icon`.

## Impact

- `assets/brand/source.png` renamed to `assets/brand/variant-worktrees.png`; `assets/brand/render-icons.ts` and the variant-vscode product-icon test read the new path.
- New source `assets/brand/chat-renamer.png`.
- New `packages/chat-renamer-vscode/media/icon-128.png`.
- `packages/chat-renamer-vscode/package.json` (`icon`) and `.vscodeignore` (whitelist).
- `packages/chat-renamer-vscode/README.md` mark.
- A chat-renamer-vscode test for the manifest path, the vsix entry, and the masked pixels.

## Non-goals

- Change variant-worktrees icon pixels, the docs logo, favicons, or the root README mark.
- Publish a 256×256 chat-renamer icon (that would upscale a 218×218 source), or 32 and 16 (those sizes exist for the docs favicon, which chat-renamer does not own).
- Draw a monochrome activity-bar icon. The extension contributes no view container.
- Knock out the black field inside the rounded rectangle. The mask is the only transparency, same as variant-worktrees.
- Set a GitHub social preview image. That lives in repository settings, not in the tree.
