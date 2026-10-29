## Why

The extension tagline names a "tree" and only the agents. The product is a git worktree plus a database for agents and for the person working beside them, and it ships as a CLI, an MCP server, and a VS Code extension. The tagline should say so.

## What Changes

- The `variant-vscode` manifest description and the tagline of both READMEs become `Isolated worktree+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs/readmes`: the extension description requirement names the new text.

## Impact

- `packages/variant-vscode/package.json` (`description`)
- `README.md` and `packages/variant-vscode/README.md` (tagline line)
- `packages/variant-vscode/src/readme.spec.ts`

## Non-goals

- Changing README structure, the docs link, or any other README text.
