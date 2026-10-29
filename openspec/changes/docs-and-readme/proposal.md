## Why

The VS Code extension is listed with the tagline "Variant Worktrees VS Code extension", which says nothing about what it does, and its package README only holds development notes and a command probe. The repository README opens with a build-from-source quick start and never says why variants exist or where the published documentation lives. A reader who lands on the Marketplace, Open VSX, or GitHub page cannot learn the product.

## What Changes

- The `variant-vscode` manifest description becomes `Isolated tree+db for your agents :: watch, seed, implode`.
- The `variant-vscode` package README is rewritten as a user-facing page that tells the story: why (an agent or a human needs a git branch and a database schema that do not collide), then how (`create`, `watch`, `implode`, `variants.yaml`, the MCP server, the chat renamer). It is selected from `docs/`, not copied. It carries no development, build, or test information, and drops the Cursor command probe section.
- The repository README gets the same story-first opening and fills in the product description, install, the human/agent workflow, configuration, CLI, MCP, and chat renamer.
- Both READMEs start with a link to the online documentation (`https://jubr.github.io/variant-worktrees/`), above the story.
- The repository README keeps the 256×256 product icon and its package list; contributor setup stays a short pointer to `CONTRIBUTING.md`.
- The `variant` CLI reports the `variant-api` package version in `--version` and the `--help` header. It printed a fixed `v0.0.1` while releases were `v0.0.3`, which the documented `variant --help` output exposes.

## Capabilities

### New Capabilities

- `docs/readmes`: what the repository README and the `variant-vscode` package README present, the documentation link they open with, and the extension description.

### Modified Capabilities

- `variant-api/commands`: adds a requirement that the CLI reports the package version. The icon requirement for the repository README (`variant-vscode/product-icon`) is unchanged.

## Impact

- `packages/variant-vscode/package.json` (`description`)
- `packages/variant-vscode/README.md`
- `README.md`
- `packages/variant-api/src/cli.ts` and `packages/variant-api/test/cli.test.ts` (version)
- A new colocated test in `packages/variant-vscode/src/` that reads both READMEs and the manifest.

## Non-goals

- Changing `docs/` pages, the VitePress configuration, or the chat-renamer package README.
- Changing the `displayName`, icon, or any extension behavior.
- Documenting how to build, test, or release from source in the extension README.
