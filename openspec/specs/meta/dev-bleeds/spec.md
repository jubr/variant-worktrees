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

### Requirement: Optional runtime executable for compiled CLI

`task bleed:cli` and `task package:cli` SHALL choose, for each target they compile, the runtime of the compiled `variant` in this order, and SHALL print which one they chose and why before compiling it. (1) When the environment variable `VARIANT_BUN_RUNTIME` is set to a non-empty value, they SHALL embed the executable it names; that fits one target, so `task package:cli:all` SHALL fail before compiling when it is set. (2) Otherwise, for a Linux or macOS target, they SHALL fetch the slim runtime of that platform from `github.com/jubr/bun-slim` (as `scripts/fetch-bun-slim.ts` does: the newest build of the Bun version `mise.toml` pins, checked against `SHA256SUMS`) and embed it. (3) Otherwise they SHALL embed the default Bun runtime that ships with Bun; for a Windows target they SHALL print that as information, since no slim runtime exists for Windows, and for any other target they SHALL print a warning that the fetch failed and why, and SHALL NOT fail for that reason. The compiled `variant` SHALL keep the same commands, flags, output and exit codes whichever runtime it embeds. When `VARIANT_BUN_RUNTIME` names a file that does not exist or is not executable, the task SHALL fail before compiling, SHALL name that path, and SHALL leave `vw-bleeds` and `out/` unchanged. No workflow other than the release workflow SHALL set the variable, and the release workflow SHALL NOT set it.

#### Scenario: Runtime supplied

- **WHEN** `VARIANT_BUN_RUNTIME` names an executable runtime and `task bleed:cli` succeeds
- **THEN** `vw-bleeds/variant-cli/bin/variant` is a symlink to a compiled executable that embeds that runtime
- **AND** `variant --version` prints the same version token as without the variable

#### Scenario: Runtime unset on Linux or macOS

- **WHEN** `VARIANT_BUN_RUNTIME` is unset or empty and `task package:cli` compiles a Linux or macOS target
- **THEN** the task fetches the slim runtime of that platform, embeds it, and prints that it chose the fetched slim runtime, with its release

#### Scenario: Fetch fails

- **WHEN** `VARIANT_BUN_RUNTIME` is unset, the slim runtime cannot be fetched (no release for the pinned Bun version, a failed download, or a checksum mismatch) and a Linux or macOS target is compiled
- **THEN** the task prints a warning with the reason, embeds the default runtime, and succeeds

#### Scenario: Windows target

- **WHEN** `VARIANT_BUN_RUNTIME` is unset and a Windows target is compiled
- **THEN** the task does not fetch, prints information that Windows has no slim runtime, and embeds the default runtime

#### Scenario: Each target of all

- **WHEN** `VARIANT_BUN_RUNTIME` is unset and `task package:cli:all` runs
- **THEN** each target gets its own choice and its own printed line

#### Scenario: Runtime file missing

- **WHEN** `VARIANT_BUN_RUNTIME` names a path that does not exist and `task bleed:cli` runs
- **THEN** the task exits non-zero and names that path
- **AND** `vw-bleeds/variant-cli/bin` is unchanged

#### Scenario: All platforms with one runtime

- **WHEN** `VARIANT_BUN_RUNTIME` is set and `task package:cli:all` runs
- **THEN** the task exits non-zero and compiles nothing

#### Scenario: Slim runtime runs the CLI

- **WHEN** a `variant` compiled with a runtime that lacks Bun's bundler, package manager and test runner runs `variant list`, `variant ui --detach` and `variant mcp`
- **THEN** each command behaves as it does with the default runtime

#### Scenario: No workflow sets it

- **WHEN** the workflow files are read
- **THEN** no workflow references `VARIANT_BUN_RUNTIME`
