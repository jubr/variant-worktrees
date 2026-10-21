## 1. Source filenames

- [x] 1.1 Rename `assets/brand/source.png` to `assets/brand/variant-worktrees.png`. Point `assets/brand/render-icons.ts` and `packages/variant-vscode/src/product-icon.spec.ts` at that path. Verify the variant-vscode product-icon test passes and both files read `assets/brand/variant-worktrees.png`.
- [x] 1.2 Copy `openspec/changes/chat-renamer-logo/assets/chat-renamer.png` to `assets/brand/chat-renamer.png`. Verify the copy is a 218×218 PNG with an alpha channel.

## 2. Failing icon contract

- [x] 2.1 Add a failing `packages/chat-renamer-vscode` test for [specs/chat-renamer-vscode/product-icon](../../specs/chat-renamer-vscode/product-icon/spec.md): manifest `icon` is `media/icon-256.png` and that PNG is 256×256; `.vscodeignore` whitelists `media/icon-256.png` and `media/icon-128.png`; `media/icon-128.png` is 128×128; each PNG matches a center-crop then lanczos3 resize of `assets/brand/chat-renamer.png` with no rounded-rectangle mask, every channel including alpha; the package README embeds `media/icon-128.png` and does not embed `media/icon-256.png`. Verify the test fails before any chat-renamer icon file or manifest edit.

## 3. Icon and wiring

- [x] 3.1 Extend `assets/brand/render-icons.ts` so variant-worktrees outputs keep the mask and chat-renamer outputs skip it. Generate `packages/chat-renamer-vscode/media/icon-256.png` and `icon-128.png` from `assets/brand/chat-renamer.png`. Verify the pixel-match assertions in the task 2.1 test pass and the variant-vscode product-icon test still passes.
- [x] 3.2 Set `packages/chat-renamer-vscode/package.json` `icon` to `media/icon-256.png` and whitelist `media/icon-256.png` and `media/icon-128.png` in `.vscodeignore`. Verify the manifest assertions in the task 2.1 test pass.
- [x] 3.3 Embed the 128×128 icon in `packages/chat-renamer-vscode/README.md`. Verify the README assertion in the task 2.1 test passes.
- [x] 3.4 Package the extension and verify the vsix contains `media/icon-256.png` and `media/icon-128.png`.

## 4. Validation

- [x] 4.1 Run the chat-renamer-vscode tests, the variant-vscode product-icon test, `openspec validate --all --strict --no-interactive`, and lint on the changed files. Verify they pass.
