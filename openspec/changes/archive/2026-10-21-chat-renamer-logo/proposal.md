## Why

`chat-renamer-vscode` has no product icon. The extension manifest, the packaged extension, and the package README show no mark, so Marketplace and the editor list it as an unbranded extension. The only brand source in the repo is `assets/brand/source.png`, which is the variant-worktrees artwork, so a second picture cannot be added without taking that file's name.

## What Changes

- Rename `assets/brand/source.png` to `assets/brand/variant-worktrees.png`. Variant-worktrees icons, the docs logo, favicons, and the repository README mark stay the same picture, including the rounded-rectangle mask.
- Adopt the supplied chat-renamer artwork (cube and "NAME" speech bubble, 218×218 PNG with alpha, at `assets/chat-renamer.png` in this change) as `assets/brand/chat-renamer.png`.
- Publish square scales at 256 and 128 through `assets/brand/render-icons.ts`. Center-crop, then lanczos3. No rounded-rectangle mask. Corners stay the scaled artwork.
- Point the `chat-renamer-vscode` manifest at the 256×256 PNG and include that file in the packaged extension. That size exists to satisfy VS Code. Show the 128×128 PNG in the package README and any other mark.

## Capabilities

### New Capabilities

- `chat-renamer-vscode/product-icon`: the manifest points VS Code at a 256×256 scale. The package README shows the 128×128 scale.

### Modified Capabilities

None. Renaming the variant-worktrees source file does not change the pixels or the surfaces in `variant-vscode/product-icon`.

## Impact

- `assets/brand/source.png` renamed to `assets/brand/variant-worktrees.png`; `assets/brand/render-icons.ts` and the variant-vscode product-icon test read the new path.
- `assets/brand/render-icons.ts` also writes the chat-renamer sizes, with the mask skipped for that source.
- New source `assets/brand/chat-renamer.png`.
- New `packages/chat-renamer-vscode/media/icon-256.png` and `icon-128.png`.
- `packages/chat-renamer-vscode/package.json` (`icon`) and `.vscodeignore` (whitelist).
- `packages/chat-renamer-vscode/README.md` mark.
- A chat-renamer-vscode test for the manifest path, the vsix entry, and the unmasked pixels.

## Non-goals

- Change variant-worktrees icon pixels, the docs logo, favicons, the root README mark, or that product's rounded-rectangle mask.
- Publish 32 and 16 for chat-renamer. Those sizes exist for the docs favicon, which chat-renamer does not own.
- Draw a monochrome activity-bar icon. The extension contributes no view container.
- Set a GitHub social preview image. That lives in repository settings, not in the tree.
