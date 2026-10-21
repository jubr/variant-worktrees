## Context

See proposal.md for why. Variant-worktrees already publishes icons from `assets/brand/source.png` (375×374) through `assets/brand/render-icons.ts`: center-crop to the short side, lanczos3 resize, then a `dest-in` rounded rectangle flush with the icon, corner radius one tenth of the side. Outputs are `packages/variant-vscode/media/icon-256.png`, `icon-128.png`, `docs/public/logo-256.png`, `favicon-32.png`, and `favicon-16.png`. The contract is [specs/variant-vscode/product-icon](../../specs/variant-vscode/product-icon/spec.md). `packages/chat-renamer-vscode/package.json` has no `icon`. Its `.vscodeignore` ignores everything, then whitelists `dist`, the changelog, the license, and the readme. The supplied artwork in this change is a 218×218 PNG with an alpha channel.

## Goals / Non-Goals

**Goals:**

- Two named source files under `assets/brand/`. The renderer and the variant-worktrees pixel test read `variant-worktrees.png`.
- Checked-in 256 and 128 chat-renamer PNGs from the same renderer, without a mask. The manifest points at 256 for VS Code. Every shown mark uses 128.

**Non-Goals:**

- Regenerating the variant-worktrees PNGs. The source bytes do not change, and that product keeps its mask.
- A second image library. `sharp` is already a workspace dev dependency.
- Docs logo, favicon, 32, or 16 entries for chat-renamer.

## Decisions

### Rename the existing source

`assets/brand/source.png` becomes `assets/brand/variant-worktrees.png`. `render-icons.ts` and `packages/variant-vscode/src/product-icon.spec.ts` switch to that path. No other pixels move.

Alternative: keep the generic `source.png` and add `chat-renamer.png` beside it. Rejected because the generic name stops saying which product it is once two sources exist.

### Same renderer, mask only for variant-worktrees

`render-icons.ts` takes a source path, a size, and whether to mask. Variant-worktrees outputs pass `mask: true` and stay on the current `dest-in` rect (`rx` = `size / 10`). Chat-renamer outputs pass `mask: false`: center-crop (a no-op on a square), lanczos3, `ensureAlpha`, no composite. Cache by source, size, and mask flag so a masked 256 and an unmasked 256 stay distinct.

| File | Pixels | Mask |
| --- | --- | --- |
| `packages/chat-renamer-vscode/media/icon-256.png` | 256 | no |
| `packages/chat-renamer-vscode/media/icon-128.png` | 128 | no |

Copy `openspec/changes/chat-renamer-logo/assets/chat-renamer.png` to `assets/brand/chat-renamer.png`. Regeneration reads the stable path. The change directory moves on archive.

The source is 218×218, so 256 is an upscale and too large to show. Generate it anyway and point `icon` at it, because that is the size VS Code recommends for the manifest. The variant-worktrees no-upscale rule stays on that product, whose source is 375×374.

Alternative: point `icon` at 128 and skip 256. Rejected because the manifest would miss the size VS Code asks for.

### Packaging and README

Set `icon` to `media/icon-256.png`. Whitelist `!media/icon-256.png` and `!media/icon-128.png`. Do not add a `files` list. The package script already writes `out/chat-renamer-<version>.vsix`. The test packages the extension and finds both files in the vsix: 256 because the manifest names it, 128 because the README shows it.

The chat-renamer test compares every pixel of each published PNG to the unmasked lanczos3 scale, alpha included. The variant-worktrees test keeps its rounded-rectangle checks.

The package README embeds `./media/icon-128.png` and does not embed the 256 file. GitHub renders the 128 from that directory.

## Risks / Trade-offs

- [256 upscales a 218 source, so "NAME" softens] → Accept for the manifest file only. Shown marks use the 128 downscale.
- [`.vscodeignore` drops an icon] → Whitelist `media/icon-256.png` and `media/icon-128.png`, and have the package test open the vsix.
- [A reader still opens `assets/brand/source.png`] → The variant-worktrees pixel test fails until that path is updated. Search the tree for the old name.
- [`sharp` native binary] → Already a dev dependency. Extension runtime code does not import it.

## Migration Plan

Rename one source file, add the second, generate the two unmasked PNGs, wire the manifest, the ignore whitelist, and the package README.

Rollback: rename `assets/brand/variant-worktrees.png` back to `assets/brand/source.png`, restore the two path references, delete `assets/brand/chat-renamer.png` and `packages/chat-renamer-vscode/media/icon-256.png` and `icon-128.png`, and remove `icon`, the whitelist lines, and the README image.
