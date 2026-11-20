## ADDED Requirements

### Requirement: Release executables use the cached slim runtime

The release workflow SHALL compile the `variant` executables with one job per supported platform, each compiling only that platform's executable. For a Linux or macOS platform, the job SHALL try to restore the cached `bun-standalone` binary of that platform, built for the pull request head and workflow file hash that the CI call reports, and SHALL compile with `VARIANT_BUN_RUNTIME` naming it when the restore finds one. When the restore finds none, the job SHALL compile with the default runtime and SHALL NOT fail for that reason. A Windows job SHALL NOT restore a slim runtime and SHALL NOT set `VARIANT_BUN_RUNTIME`. The release assets, their names, and the checksum file SHALL be the same as without this requirement.

#### Scenario: Cached runtime found

- **WHEN** the cache holds the `bun-standalone` binary of `linux-x64` for the reported head and hash and the Linux x64 job runs
- **THEN** that job compiles with `VARIANT_BUN_RUNTIME` naming the restored binary

#### Scenario: Nothing cached

- **WHEN** the cache holds no `bun-standalone` binary for a Linux or macOS platform
- **THEN** that platform's job compiles with the default runtime and succeeds

#### Scenario: Windows

- **WHEN** the Windows x64 or Windows arm64 job runs
- **THEN** it does not restore a slim runtime and does not set `VARIANT_BUN_RUNTIME`

#### Scenario: Same assets

- **WHEN** every platform job succeeds
- **THEN** the release assets are the two `.vsix` files, six `variant` executables named `variant-<version>-<os>-<arch>[.exe]`, and `SHA256SUMS`
