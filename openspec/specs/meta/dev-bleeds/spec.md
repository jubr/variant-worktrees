# meta/dev-bleeds Specification

## Purpose

Publish a local extension and CLI (which starts the MCP server as `variant mcp`) into one directory beside the checkout so an editor and Mise can load them without using release asset paths.

## Requirements

### Requirement: Bleed directory beside the checkout

`task bleed:vsix`, `task bleed:cli`, and `task bleed:all` SHALL publish under `vw-bleeds` in the parent of the checkout that runs the task. The load locations SHALL be `vw-bleeds/variant-vscode` and `vw-bleeds/variant-cli`. A task SHALL NOT use `out/variant-worktrees-main` as a load location.

#### Scenario: Main checkout

- **WHEN** `task bleed:vsix` runs in the main checkout
- **THEN** the unpacked extension is written to `vw-bleeds/variant-vscode` in the parent of that checkout

#### Scenario: Variant worktree

- **WHEN** `task bleed:vsix` runs in a variant worktree
- **THEN** the unpacked extension is written to `vw-bleeds/variant-vscode` in the parent of that worktree
- **AND** the worktree has no `out/variant-worktrees-main`

### Requirement: Extension bleed

`task bleed:vsix` SHALL build and package the variant-worktrees extension and unpack it so `package.json` is at the root of `vw-bleeds/variant-vscode`. The folder SHALL be loadable as an extension from that location. Files that belong only to the vsix wrapper SHALL NOT be in that folder. When the destination already holds files the new package does not contain, the destination SHALL hold exactly the new package. A failed package SHALL leave the previous destination in place.

#### Scenario: Loadable root

- **WHEN** `task bleed:vsix` succeeds
- **THEN** `vw-bleeds/variant-vscode/package.json` exists
- **AND** the file named by that manifest's `main` exists at that path under the folder

#### Scenario: Stale files replaced

- **WHEN** `vw-bleeds/variant-vscode` already holds a file the new package does not contain
- **THEN** after a successful task that file is gone and `package.json` is present

#### Scenario: Failed package keeps the previous tree

- **WHEN** packaging the extension fails and `vw-bleeds/variant-vscode` already exists
- **THEN** the task exits non-zero and the previous tree is unchanged

### Requirement: CLI bleed

`task bleed:cli` SHALL build the `variant` executable for the host platform and place it at `vw-bleeds/variant-cli/bin/variant-<version>-<slug>-<n>-<hash4>`, executable. `<version>` is the `variant-cli` package version. `<slug>-<n>-<hash4>` is the checkout variant printed by `variant --version`. On `main` the file is `bin/variant-<version>`. The task SHALL replace `vw-bleeds/variant-cli/bin/variant` with a symlink to that file. Of the files named `variant-<version>-<slug>-*`, only the three newest SHALL remain. Binaries for another version or slug SHALL stay. The task SHALL NOT run `mise link` or any other Mise command. A failed compile SHALL leave the directory unchanged.

#### Scenario: Host executable

- **WHEN** `task bleed:cli` succeeds on a feature checkout
- **THEN** `vw-bleeds/variant-cli/bin/variant-<version>-<slug>-<n>-<hash4>` exists and is executable
- **AND** `vw-bleeds/variant-cli/bin/variant` is a symlink to that file

#### Scenario: Mise is not invoked

- **WHEN** `task bleed:cli` runs
- **THEN** it does not execute `mise`

#### Scenario: Other versions stay

- **WHEN** `vw-bleeds/variant-cli/bin` already holds a versioned binary from another checkout
- **THEN** after a successful task that binary is still there
- **AND** `bin/variant` points at the binary just written

#### Scenario: Failed compile keeps the previous executable

- **WHEN** compiling the CLI fails and `vw-bleeds/variant-cli` already holds a binary
- **THEN** the task exits non-zero and that directory is unchanged

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
