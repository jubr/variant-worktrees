## RENAMED Requirements

- FROM: `### Requirement: All three bleeds`
- TO: `### Requirement: Both bleeds`

## MODIFIED Requirements

### Requirement: Bleed directory beside the checkout

`task bleed:vsix`, `task bleed:cli`, and `task bleed:all` SHALL publish under `vw-bleeds` in the parent of the checkout that runs the task. The load locations SHALL be `vw-bleeds/variant-vscode` and `vw-bleeds/variant-cli`. A task SHALL NOT use `out/variant-worktrees-main` as a load location.

#### Scenario: Main checkout

- **WHEN** `task bleed:vsix` runs in the main checkout
- **THEN** the unpacked extension is written to `vw-bleeds/variant-vscode` in the parent of that checkout

#### Scenario: Variant worktree

- **WHEN** `task bleed:vsix` runs in a variant worktree
- **THEN** the unpacked extension is written to `vw-bleeds/variant-vscode` in the parent of that worktree
- **AND** the worktree has no `out/variant-worktrees-main`

### Requirement: Both bleeds

`task bleed:all` SHALL run `bleed:vsix`, then `bleed:cli`. When either fails, `bleed:all` SHALL exit non-zero. Directories already replaced earlier in that run SHALL stay replaced. The executable `vw-bleeds/variant-cli/bin/variant` starts the MCP server as `variant mcp`.

#### Scenario: Success

- **WHEN** `task bleed:all` succeeds
- **THEN** `vw-bleeds/variant-vscode/package.json` and `vw-bleeds/variant-cli/bin/variant` both exist

#### Scenario: Later task fails

- **WHEN** `bleed:vsix` succeeds and `bleed:cli` fails during `task bleed:all`
- **THEN** `bleed:all` exits non-zero
- **AND** `vw-bleeds/variant-vscode` holds the extension just unpacked

### Requirement: Retired unpacked task

`task package:vsix:unpacked` SHALL NOT be defined, and neither SHALL `task bleed:mcp`. `task package:vsix` and `task package:cli` SHALL remain.

#### Scenario: Task list

- **WHEN** the task names are listed
- **THEN** `package:vsix:unpacked` and `bleed:mcp` are absent
- **AND** `bleed:vsix`, `bleed:cli`, `bleed:all`, `package:vsix`, and `package:cli` are present

## REMOVED Requirements

### Requirement: MCP bleed

**Reason**: The MCP server is started as `variant mcp` by the CLI executable, so no second executable is built or published.

**Migration**: Run `task bleed:cli` and point MCP clients at `vw-bleeds/variant-cli/bin/variant` with the argument `mcp`. Remove a leftover `vw-bleeds/variant-mcp` by hand.
