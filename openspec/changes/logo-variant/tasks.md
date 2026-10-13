## 1. Failing icon contract

- [ ] 1.1 Copy `openspec/changes/logo-variant/assets/source.png` to `assets/brand/source.png` and add `sharp` as a workspace dev dependency. Verify the source PNG is 375×374 and `sharp` imports under Bun.
- [ ] 1.2 Add a failing `packages/variant-vscode` test for [specs/variant-vscode/product-icon](../../specs/variant-vscode/product-icon/spec.md): manifest `icon` is `media/icon-256.png` and that PNG is 256×256; `files` includes it; `media/icon-128.png`, `docs/public/favicon-32.png`, and `docs/public/favicon-16.png` exist at those sizes; each PNG matches a center-crop to 374×374 then lanczos3 resize of `assets/brand/source.png`, masked to a rounded rectangle of radius one quarter of the side with fully transparent pixels outside that rounded rectangle; `docs/public/logo-256.png` matches `media/icon-256.png`; docs config sets `themeConfig.logo` to `/logo-256.png` and favicon links for 32 and 16; root README embeds `packages/variant-vscode/media/icon-256.png`. Verify the test fails before any icon files or manifest edits.

## 2. Assets and wiring

- [ ] 2.1 Generate the five PNGs from the source with that crop, resize, and rounded-rectangle mask. Verify the pixel-match assertions in the task 1.2 test pass.
- [ ] 2.2 Set `packages/variant-vscode/package.json` `icon` to `media/icon-256.png` and add that path to `files`. Verify the manifest assertions in the task 1.2 test pass.
- [ ] 2.3 Point VitePress `themeConfig.logo` and favicon `head` links at the docs PNGs, and embed the 256×256 icon in the root README. Verify the docs and README assertions in the task 1.2 test pass.
- [ ] 2.4 Package the extension and verify the vsix contains `media/icon-256.png`.

## 3. Validation

- [ ] 3.1 Run the variant-vscode tests, `openspec validate --all --strict --no-interactive`, and lint on the changed files. Verify they pass.
