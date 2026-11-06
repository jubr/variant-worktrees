## 1. Extension bleed

- [x] 1.1 Add failing tests for [specs/meta/dev-bleeds | Bleed directory beside the checkout](../../specs/meta/dev-bleeds/spec.md#requirement-bleed-directory-beside-the-checkout) and [specs/meta/dev-bleeds | Extension bleed](../../specs/meta/dev-bleeds/spec.md#requirement-extension-bleed): a checkout and a sibling worktree each unpack a fixture vsix into `<parent>/vw-bleeds/variant-vscode` with `package.json` at the root and the manifest `main` file present; the vsix wrapper is absent; a stale file in that directory is gone after success; a vsix without `extension/package.json` leaves the previous tree and fails; the worktree gets no `out/variant-worktrees-main`. Run `bun test` on the new spec and see it fail.
- [x] 1.2 Implement that publish path. Keep the existing `AIDEV-NOTE` comments in the unpack script. Stop publishing `out/variant-worktrees-main`. The tests of 1.1 pass.

## 2. CLI bleed

- [x] 2.1 Add failing tests for [specs/meta/dev-bleeds | CLI bleed](../../specs/meta/dev-bleeds/spec.md#requirement-cli-bleed): a successful host compile is published as the only file `vw-bleeds/variant-cli/bin/variant`, executable; a stale extra file is gone; a failed compile leaves the previous `bin/variant` byte-for-byte; the publish path runs no `mise` process. Run `bun test` on that spec and see it fail.
- [x] 2.2 Publish the host executable from the existing CLI compile into that path, replacing `vw-bleeds/variant-cli` only after the compile succeeds. The tests of 2.1 pass. `task package:cli` still writes the versioned asset under `out/`.

## 3. MCP bleed

- [x] 3.1 Add failing tests for [specs/meta/dev-bleeds | MCP bleed](../../specs/meta/dev-bleeds/spec.md#requirement-mcp-bleed): a successful host compile is published as the only file `vw-bleeds/variant-mcp/bin/variant-mcp`, executable; a stale extra file is gone; a failed compile leaves the previous executable unchanged. Run `bun test` on that spec and see it fail.
- [x] 3.2 Compile `variant-mcp` for the host with dependencies included and publish it to that path only after the compile succeeds. The tests of 3.1 pass.
- [x] 3.3 Spawn `vw-bleeds/variant-mcp/bin/variant-mcp` with the checkout's `node_modules` hidden and confirm the process does not exit with a missing-module error. Record that check next to the 3.1 spec.

## 4. Tasks

- [x] 4.1 Add failing coverage for [specs/meta/dev-bleeds | All three bleeds](../../specs/meta/dev-bleeds/spec.md#requirement-all-three-bleeds) and [specs/meta/dev-bleeds | Retired unpacked task](../../specs/meta/dev-bleeds/spec.md#requirement-retired-unpacked-task): `Taskfile.yaml` defines `bleed:vsix`, `bleed:cli`, `bleed:mcp`, and `bleed:all`; `bleed:all` runs those three in that order; `package:vsix:unpacked` is absent; `package:vsix` and `package:cli` remain. Run `bun test` on that spec and see it fail.
- [x] 4.2 Wire the four tasks. Each single bleed task builds, then publishes. `bleed:all` calls `bleed:vsix`, `bleed:cli`, and `bleed:mcp` in that order. Remove `package:vsix:unpacked`. `task --list` shows the four bleed names and both package names, and omits `package:vsix:unpacked`. The tests of 4.1 pass.

## 5. Notes and validation

- [x] 5.1 Add an `Unreleased` bullet in `CHANGELOG.md` for the retired task and the three `vw-bleeds` destinations. Confirm the bullet names `bleed:vsix`, `bleed:cli`, `bleed:mcp`, and the removal of `package:vsix:unpacked`.
- [x] 5.2 Run `openspec validate --all --strict --no-interactive` and `bun test` for the bleed specs. Both succeed.
