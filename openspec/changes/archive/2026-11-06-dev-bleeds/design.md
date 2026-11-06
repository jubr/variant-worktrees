## Context

See proposal.md. `task package:vsix:unpacked` builds the variant-worktrees vsix and unpacks the `extension/` root into the main checkout at `out/variant-worktrees-main`. `task package:cli` compiles a host executable to `out/variant-<version>-<os>-<arch>`. Mise installs of `github:jubr/variant-worktrees` expose that executable as `bin/variant`. `variant-mcp` publishes a Node program whose dependencies stay external. Worktrees live as siblings of the main checkout.

## Goals / Non-Goals

**Goals:**

- One directory beside the running checkout holds three replaceable install roots.
- The CLI root matches a Mise install directory for `github:jubr/variant-worktrees`.
- The MCP executable runs without the checkout's `node_modules`.
- Release tasks `package:vsix` and `package:cli` stay as they are.

**Non-Goals:**

- Invoking `mise link`.
- A chat-renamer bleed directory.
- Cross-compiling bleed executables.

## Decisions

### Bleed root is the parent of the running checkout

`vw-bleeds` is `../vw-bleeds` from the Taskfile directory. Scripts resolve it from the checkout that contains them. Sibling worktrees and the main checkout therefore share one directory. The old helper that redirected a worktree into the main checkout's `out/` is not used for bleeds.

Alternative: always resolve the main checkout, then step up to its parent. That matches this repo's sibling layout and diverges when a worktree is created somewhere else. The task path the operator named is the running checkout.

### Each product directory is replaced wholesale

`bleed:vsix` replaces `vw-bleeds/variant-vscode`, `bleed:cli` replaces `vw-bleeds/variant-cli`, and `bleed:mcp` replaces `vw-bleeds/variant-mcp`. Other children of `vw-bleeds` stay. Replacement happens after the new payload is known to be valid (the vsix unpacked with `package.json` at the extension root, or the executable compiled), so a failed build leaves the previous directory in place.

Alternative: delete only files the new tree does not contain. A full replace matches the current unpack and drops renamed leftovers.

### Extension payload stays an unpacked vsix

`bleed:vsix` still packages `packages/variant-vscode` to a vsix under the checkout `out/`, then copies the `extension/` directory so `package.json` is the root of `vw-bleeds/variant-vscode`. The vsix wrapper stays out of that folder. The load location is no longer `out/variant-worktrees-main`.

### CLI bleed is the host executable at `bin/variant`

Reuse the existing host compile. Write the bytes to `vw-bleeds/variant-cli/bin/variant` and mark it executable. The versioned name under `out/` remains the release asset from `package:cli`; the bleed name is the stable `variant` Mise puts on `PATH` from `<install>/bin`.

Alternative: symlink `bin/variant` at `out/variant-<version>-<os>-<arch>`. A later clean of `out/` would break the link. The bleed directory owns the file.

### MCP bleed is a compiled host executable

Compile `packages/variant-mcp` for the host with dependencies included, to `vw-bleeds/variant-mcp/bin/variant-mcp`. The Node package build keeps dependencies external so it can publish to npm; that layout needs `node_modules` and dies with the worktree.

Alternative: copy `dist/` plus a populated `node_modules`. It is not self-contained.

### `bleed:all` is the three tasks in order

`vsix`, then `cli`, then `mcp`. `build` is `run: once`, so one `bleed:all` invocation builds once. Each single task still builds, so it can run alone. A failure stops the sequence and exits non-zero; directories already replaced in that run stay replaced.

## Risks / Trade-offs

- [Sibling assumption] A worktree that is not a child of the same parent writes a different `vw-bleeds`. → The path is the running checkout's parent, which is the layout `variant create` uses here.
- [Host-only binaries] A bleed cannot be copied to another OS. → Release executables stay on `package:cli`.
- [Large MCP binary] Bundling the MCP SDK makes a bigger file than `dist/mcp.js`. → The install does not depend on the checkout.
- [Shared directory] A bleed from one worktree replaces what another worktree published. → That is the live install location; the last successful task wins. A failed compile does not clear it.

## Migration Plan

1. Land the four tasks and remove `package:vsix:unpacked`.
2. Point "Extension from location" at `vw-bleeds/variant-vscode`.
3. Run `mise link github:jubr/variant-worktrees@bleed` at `vw-bleeds/variant-cli` by hand.
4. Point MCP clients at `vw-bleeds/variant-mcp/bin/variant-mcp`.

Rollback: restore `package:vsix:unpacked` and the `out/variant-worktrees-main` publish. `vw-bleeds` is untracked and can be deleted by hand.

## Open Questions

None.
