## Purpose

Defines when and how the `variant` command rewrites a configuration that uses names of an earlier version, and what it tells the user.

## ADDED Requirements

### Requirement: CLI rewrites a migrated configuration

After loading a configuration that needed a migration (see `variant-config/core`), the `variant` command SHALL best-effort rewrite the file with the current names, and SHALL continue with the command whether or not the rewrite happens or succeeds. `variants.yaml` SHALL be rewritten only when it is tracked by git and has no uncommitted changes, so that the rewrite is visible in `git diff` and undone by `git checkout`. `variants.local.yaml`, which is git-ignored and written by the tool itself, SHALL be rewritten without that condition. No file SHALL be rewritten when the environment variable `CI` is set to a value other than empty, `0` or `false`, or when `VARIANT_MIGRATE` is `0`. After a rewrite the command SHALL print on standard error the file, each change, and that the file is tracked by git, so the change can be reviewed with `git diff` and reverted with `git checkout -- <file>`. When a file needs a migration and is not rewritten, the command SHALL print on standard error the file, each change and the reason (not tracked, uncommitted changes, `CI`, `VARIANT_MIGRATE`, or the write failure), and the command SHALL still run on the migrated reading. The messages SHALL appear once per process and file. Library calls (`variant-api`), the MCP server and `variant ui` SHALL NOT write the file.

#### Scenario: Tracked and clean

- **WHEN** `variants.yaml` is tracked, unchanged since its last commit, uses `variant.instances`, and a user runs `variant list`
- **THEN** the file afterwards uses `variant.watches`, stderr names the file and the change and mentions `git diff` and `git checkout`, and the list is printed

#### Scenario: Uncommitted changes

- **WHEN** the same file has uncommitted changes
- **THEN** it is not rewritten, stderr says why and names the change to make by hand, and the command runs

#### Scenario: Not tracked

- **WHEN** `variants.yaml` is not tracked by git
- **THEN** it is not rewritten and stderr says it is not tracked

#### Scenario: Opt out in CI

- **WHEN** `CI=true` is set, or `VARIANT_MIGRATE=0`
- **THEN** no file is rewritten and the command runs on the migrated reading

#### Scenario: Runtime state file

- **WHEN** a `variants.local.yaml` uses `runtime.instances` and a `variant` command loads it
- **THEN** the file is rewritten with `runtime.watches` although it is git-ignored, unless an opt-out applies

#### Scenario: Write fails

- **WHEN** the file is read-only
- **THEN** the command prints that it could not rewrite the file and still runs

#### Scenario: Library does not write

- **WHEN** a program loads the same configuration through `variant-api` or the MCP server
- **THEN** the file is unchanged
