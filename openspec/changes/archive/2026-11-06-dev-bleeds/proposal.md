## Why

Loading a local build means unpacking the extension into the checkout's `out/` and pointing Mise at a versioned executable under `out/`. Those locations are not the folders a person already uses for "Extension from location" and `mise link`. One bleed directory beside the checkout should hold the extension, the CLI, and the MCP server.

## What Changes

- **BREAKING** `task package:vsix:unpacked` goes away. It no longer writes `out/variant-worktrees-main`.
- `task bleed:vsix` builds the variant-worktrees extension and unpacks it so `package.json` sits at the root of `vw-bleeds/variant-vscode`, ready for "Extension from location".
- `task bleed:cli` builds the host `variant` executable and places it at `vw-bleeds/variant-cli/bin/variant`, ready for `mise link github:jubr/variant-worktrees@bleed` pointed at that directory. The task does not run `mise link`.
- `task bleed:mcp` builds a host `variant-mcp` executable and places it at `vw-bleeds/variant-mcp/bin/variant-mcp`.
- `task bleed:all` runs the three.
- `vw-bleeds` is the sibling of the checkout that runs the task (`../vw-bleeds`). A variant worktree and the main checkout are siblings, so they share that directory. Each destination is replaced, so files the new package does not contain are gone.
- `task package:vsix` and `task package:cli` stay the release packaging tasks.

## Capabilities

### New Capabilities

- `meta/dev-bleeds`: local bleed tasks and the three directories they publish beside the checkout.

### Modified Capabilities

- `meta/release-artifacts`: the requirement that `task package:vsix:unpacked` unpacks into `out/variant-worktrees-main` is removed.

## Impact

- `Taskfile.yaml`: drop `package:vsix:unpacked`; add `bleed:vsix`, `bleed:cli`, `bleed:mcp`, and `bleed:all`.
- The unpack script and its tests move from publishing into the main checkout's `out/` to publishing `vw-bleeds/variant-vscode`. CLI and MCP bleed scripts publish the other two directories.
- `CHANGELOG.md` records the task rename and the new destinations.
- CI release workflows keep `task package:vsix` and `task package:cli`. They do not call the bleed tasks.

## Non-goals

- Running `mise link`, or installing any other Mise version.
- Bleeding chat-renamer.
- Changing release asset names, platforms, or registry publication.
- Compiling the CLI or MCP server for every release platform. A bleed is the host executable only.
- Putting `vw-bleeds` inside the git checkout.
