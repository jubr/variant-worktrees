## Context

See proposal.md for why. Variant-worktrees already publishes icons from `assets/brand/source.png` (375×374) through `assets/brand/render-icons.ts`: center-crop to the short side, lanczos3 resize, then a `dest-in` rounded rectangle flush with the icon, corner radius one tenth of the side. Outputs are `packages/variant-vscode/media/icon-256.png`, `icon-128.png`, `docs/public/logo-256.png`, `favicon-32.png`, and `favicon-16.png`. The contract is [specs/variant-vscode/product-icon](../../specs/variant-vscode/product-icon/spec.md). `packages/chat-renamer-vscode/package.json` has no `icon`. Its `.vscodeignore` ignores everything, then whitelists `dist`, the changelog, the license, and the readme. The supplied artwork in this change is a 218×218 PNG with an alpha channel.

## Goals / Non-Goals

**Goals:**

- Two named source files under `assets/brand/`. The renderer and the variant-worktrees pixel test read `variant-worktrees.png`.
- One checked-in 128×128 chat-renamer PNG, masked the same way, referenced by the manifest and the package README.

**Non-Goals:**

- Regenerating the variant-worktrees PNGs. The source bytes do not change.
- A second image library. `sharp` is already a workspace dev dependency.
- Docs logo or favicon entries for chat-renamer.

## Decisions

### Rename the existing source

`assets/brand/source.png` becomes `assets/brand/variant-worktrees.png`. `render-icons.ts` and `packages/variant-vscode/src/product-icon.spec.ts` switch to that path. No other pixels move.

Alternative: keep the generic `source.png` and add `chat-renamer.png` beside it. Rejected because the generic name stops saying which product it is once two sources exist.

### 128, not 256

The source is 218×218. [specs/variant-vscode/product-icon](../../specs/variant-vscode/product-icon/spec.md) forbids an upscale, and 256 is larger than 218. 128 is the largest size that spec publishes which is still a downscale, and it is the smallest icon VS Code accepts. The manifest points at `packages/chat-renamer-vscode/media/icon-128.png`.

Alternative: upscale to 256 so a retina display is not scaling a 128 icon. Rejected because that violates the no-upscale rule. Alternative: mask the native 218 square and ship that. Rejected because the established sizes are 256, 128, 32, and 16, and 128 is the one that fits the source and the editor minimum.

### Same mask, second source

One render function takes a source path and a size. Call it for the existing variant-worktrees outputs and once more for `packages/chat-renamer-vscode/media/icon-128.png` from `assets/brand/chat-renamer.png`. Center-crop (a no-op on a square), lanczos3, `dest-in` rect at `(0,0)` with `rx` of `size / 10`.

Inside the rounded rectangle the scaled artwork is unchanged, alpha included. The variant-worktrees test expects alpha 255 there because that source is opaque. The chat-renamer test compares inside pixels to the unmasked scale, including alpha, and expects alpha 0 more than one pixel outside the rounded rectangle. The rim may be antialiased.

Copy `openspec/changes/chat-renamer-logo/assets/chat-renamer.png` to `assets/brand/chat-renamer.png`. Regeneration reads the stable path. The change directory moves on archive.

### Packaging and README

Set `icon` to `media/icon-128.png` and whitelist `!media/icon-128.png`. Do not add a `files` list. The package script already writes `out/chat-renamer-<version>.vsix`. The test packages the extension and finds `media/icon-128.png` in the vsix.

The package README embeds `./media/icon-128.png` so GitHub renders it from that directory.

## Risks / Trade-offs

- [128 loses the "NAME" lettering] → Accept. 128 is the largest size that is not an upscale.
- [`.vscodeignore` drops the icon] → Whitelist `media/icon-128.png`, and have the package test open the vsix.
- [A reader still opens `assets/brand/source.png`] → The variant-worktrees pixel test fails until that path is updated. Search the tree for the old name.
- [`sharp` native binary] → Already a dev dependency. Extension runtime code does not import it.

## Migration Plan

Rename one source file, add the second, generate the 128 PNG, wire the manifest, the ignore whitelist, and the package README.

Rollback: rename `assets/brand/variant-worktrees.png` back to `assets/brand/source.png`, restore the two path references, delete `assets/brand/chat-renamer.png` and `packages/chat-renamer-vscode/media/icon-128.png`, and remove `icon`, the whitelist line, and the README image.
