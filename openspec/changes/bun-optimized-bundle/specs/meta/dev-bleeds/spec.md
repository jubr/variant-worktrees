## ADDED Requirements

### Requirement: Optional runtime executable for compiled CLI

`task bleed:cli` and `task package:cli` SHALL embed the executable named by the environment variable `VARIANT_BUN_RUNTIME` as the runtime of the compiled `variant`, instead of the default Bun runtime, when that variable is set to a non-empty value. When it is unset or empty, they SHALL behave as before. The compiled `variant` SHALL keep the same commands, flags, output and exit codes whichever runtime it embeds. When the variable names a file that does not exist or is not executable, the task SHALL fail before compiling, SHALL name that path, and SHALL leave `vw-bleeds` and `out/` unchanged. `task package:cli:all` SHALL fail before compiling when the variable is set, because one runtime cannot serve every platform. No workflow other than the release workflow SHALL set the variable. The release workflow SHALL set it only for a Linux or macOS platform and only to a published slim runtime that `scripts/fetch-bun-slim.ts` downloaded.

#### Scenario: Runtime supplied

- **WHEN** `VARIANT_BUN_RUNTIME` names an executable runtime and `task bleed:cli` succeeds
- **THEN** `vw-bleeds/variant-cli/bin/variant` is a symlink to a compiled executable that embeds that runtime
- **AND** `variant --version` prints the same version token as without the variable

#### Scenario: Runtime unset

- **WHEN** `VARIANT_BUN_RUNTIME` is unset or empty and `task package:cli` runs
- **THEN** the compiled executable embeds the default runtime, as before

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

#### Scenario: Only the release workflow sets it

- **WHEN** the workflow files are read
- **THEN** no workflow other than the release workflow references `VARIANT_BUN_RUNTIME`
- **AND** the release workflow sets it only in steps that do not run for Windows platforms
