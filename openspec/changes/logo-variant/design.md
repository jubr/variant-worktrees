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

Use `sharp` (lanczos3) as a dev dependency to resize. Commit the PNGs. The test decodes the source, repeats that crop and resize, and expects the committed files to match. That locks "this artwork" without calling the packager.

Alternative: ImageMagick or `sips` in a script. Rejected because CI does not provide them. Alternative: commit PNGs and assert only IHDR dimensions. Rejected because any 256×256 PNG would pass.

### Stable source path

Copy `openspec/changes/logo-variant/assets/source.png` to `assets/brand/source.png`. Regeneration reads the stable path. The change directory moves on archive.

### Docs and README wiring

- `themeConfig.logo` is `/logo-256.png`.
- `head` gains icon links for `/favicon-32.png` (`32x32`) and `/favicon-16.png` (`16x16`).
- Root README embeds `packages/variant-vscode/media/icon-256.png` with a repo-relative path so GitHub renders it.

### Extension `files`

Add `media/icon-256.png` to `files`. Do not add the whole `media/` directory; the 128×128 file does not need to be inside the vsix. The test asserts `icon` is covered by `files` and that packaging the extension (`vsce package`) includes that path.

## Risks / Trade-offs

- [16×16 and 32×32 lose the swatch detail] → Accept. Those sizes are only the browser tab icon. 128 and 256 keep the picture.
- [Explicit `files` list drops the icon] → List the icon path, and have the package test open the vsix.
- [Supplied artwork includes a third-party branch mark] → Ship the supplied file unchanged apart from the square crop and downscale. Do not redraw it.
- [`sharp` native binary] → Dev dependency only. Runtime extension code does not import it.

## Migration Plan

Additive. No data migration.

Rollback: remove `icon` and the new `files` entry, delete the PNGs and `assets/brand/source.png`, and revert the docs head, `themeConfig.logo`, and README image.
