## Context

See proposal.md for why. Today `packages/variant-vscode/package.json` has no `icon`, and its `files` list is only `dist`, `README.md`, and `LICENSE.txt`. An explicit `files` list replaces the packager default, so a new icon is omitted from the vsix unless that list includes it. The docs site (`docs/.vitepress/config.ts`) has no `themeConfig.logo` and no favicon links. VitePress serves static files only from `docs/public/`. The source artwork in this change is a 375×374 PNG.

## Goals / Non-Goals

**Goals:**

- One checked-in source PNG, four checked-in square derivatives, regenerated the same way in the test.
- Manifest `icon` is the 256×256 file, and `files` is what puts it in the vsix.

**Non-Goals:**

- Generating icons at package time on every build.
- A shared image pipeline outside this asset set.

## Decisions

### Manifest icon is 256×256

VS Code requires a PNG of at least 128×128 and recommends 256×256 for high-DPI. The manifest points at `packages/variant-vscode/media/icon-256.png`. The 128×128 file stays beside it as the nominal marketplace size; the manifest does not point at it.

Alternative: point `icon` at 128×128 only. Rejected because the editor scales that file up on retina displays, and the source is sharp enough to downscale to 256.

### Sizes and square crop

Publish 256, 128, 32, and 16. Nothing larger: the source is 375×374, so 512 would be an upscale.

The source is one pixel wider than it is tall. Center-crop to 374×374 (drop one column) before resize so the output is square and the artwork is not stretched.

After resize, mask with a rounded rectangle centered on the icon. Its side is four fifths of the icon side (the previous full-bleed side, reduced by one fifth). Corner radius is one quarter of that smaller side (`(size * 4/5) / 4`). The margin and the four canvas corners are fully transparent. The rim may be antialiased. Inside the rounded rectangle the scaled artwork is unchanged.

`sharp` applies the mask with `dest-in` and an SVG rect inset by one tenth of the side, fill white. Alternative: bake an opaque rounded rectangle on a solid background. Rejected because the corners must stay transparent on the docs logo, the README, and the extension icon.

| File | Pixels | Surface |
| --- | --- | --- |
| `packages/variant-vscode/media/icon-256.png` | 256 | extension `icon`, README |
| `packages/variant-vscode/media/icon-128.png` | 128 | published marketplace size |
| `docs/public/logo-256.png` | 256 | VitePress `themeConfig.logo` |
| `docs/public/favicon-32.png` | 32 | favicon |
| `docs/public/favicon-16.png` | 16 | favicon |

`docs/public/logo-256.png` is the same bytes as `media/icon-256.png`. The docs site cannot serve a file that lives under `packages/`.

Alternative: one SVG trace. Rejected because the source is a raster composite; a trace would be a different picture.

### Resize with sharp, commit the PNGs

Use `sharp` (lanczos3) as a dev dependency to resize, then apply the rounded-rectangle mask. Commit the PNGs. The test builds the unmasked scale itself and checks geometry on its own: pixels more than one pixel outside the rounded rectangle have alpha 0, and pixels more than one pixel inside match the unmasked scale. That locks the artwork and the transparent corners without sharing the generator.

Alternative: ImageMagick or `sips` in a script. Rejected because CI does not provide them. Alternative: commit PNGs and assert only IHDR dimensions. Rejected because any 256×256 PNG would pass.

### Stable source path

Copy `openspec/changes/logo-variant/assets/source.png` to `assets/brand/source.png`. Regeneration reads the stable path. The change directory moves on archive.

### Docs and README wiring

- `themeConfig.logo` is `/logo-256.png`.
- `head` gains icon links for `/favicon-32.png` (`32x32`) and `/favicon-16.png` (`16x16`).
- Root README embeds `packages/variant-vscode/media/icon-256.png` with a repo-relative path so GitHub renders it.

### Extension packaging

`packages/variant-vscode/package.json` has no `files` list. `.vscodeignore` ignores everything, then whitelists `dist`, the changelog, the license, and the readme. Set `icon` to `media/icon-256.png` and whitelist `!media/icon-256.png` (and the `media` directory, if the ignore rules require the parent). Do not add a `files` list. The 128×128 file stays out of the vsix. The test packages the extension and finds `media/icon-256.png` in the vsix.

## Risks / Trade-offs

- [16×16 and 32×32 lose the swatch detail] → Accept. Those sizes are only the browser tab icon. 128 and 256 keep the picture.
- [`.vscodeignore` drops the icon] → Whitelist `media/icon-256.png`, and have the package test open the vsix.
- [Supplied artwork includes a third-party branch mark] → Ship the supplied file unchanged apart from the square crop, downscale, and rounded-rectangle mask. Do not redraw it.
- [`sharp` native binary] → Dev dependency only. Runtime extension code does not import it.

## Migration Plan

Additive. No data migration.

Rollback: remove `icon` and the `.vscodeignore` whitelist, delete the PNGs and `assets/brand/source.png`, and revert the docs head, `themeConfig.logo`, and README image.
