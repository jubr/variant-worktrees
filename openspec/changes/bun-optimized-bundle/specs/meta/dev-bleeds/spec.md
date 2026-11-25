## ADDED Requirements

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
