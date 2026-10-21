## 1. Source filenames

- [ ] 1.1 Rename `assets/brand/source.png` to `assets/brand/variant-worktrees.png`. Point `assets/brand/render-icons.ts` and `packages/variant-vscode/src/product-icon.spec.ts` at that path. Verify the variant-vscode product-icon test passes and both files read `assets/brand/variant-worktrees.png`.
- [ ] 1.2 Copy `openspec/changes/chat-renamer-logo/assets/chat-renamer.png` to `assets/brand/chat-renamer.png`. Verify the copy is a 218×218 PNG with an alpha channel.

## 2. Failing icon contract

- [ ] 2.1 Add a failing `packages/chat-renamer-vscode` test for [specs/chat-renamer-vscode/product-icon](../../specs/chat-renamer-vscode/product-icon/spec.md): manifest `icon` is `media/icon-128.png` and that PNG is 128×128; `.vscodeignore` whitelists it; the PNG matches a center-crop then lanczos3 resize of `assets/brand/chat-renamer.png`, masked to a rounded rectangle flush with the sides, corner radius one tenth of the side, with the same one-pixel rim tolerance as the variant-worktrees product-icon test (outside that rim, alpha 0; inside it, every channel matches the unmasked scale, alpha included); the package README embeds `media/icon-128.png`. Verify the test fails before any chat-renamer icon file or manifest edit.

## 3. Icon and wiring

- [ ] 3.1 Generate `packages/chat-renamer-vscode/media/icon-128.png` from `assets/brand/chat-renamer.png` with that crop, resize, and mask. Verify the pixel-match assertion in the task 2.1 test passes.
- [ ] 3.2 Set `packages/chat-renamer-vscode/package.json` `icon` to `media/icon-128.png` and whitelist that path in `.vscodeignore`. Verify the manifest assertions in the task 2.1 test pass.
- [ ] 3.3 Embed the 128×128 icon in `packages/chat-renamer-vscode/README.md`. Verify the README assertion in the task 2.1 test passes.
- [ ] 3.4 Package the extension and verify the vsix contains `media/icon-128.png`.

## 4. Validation

- [ ] 4.1 Run the chat-renamer-vscode tests, the variant-vscode product-icon test, `openspec validate --all --strict --no-interactive`, and lint on the changed files. Verify they pass.
