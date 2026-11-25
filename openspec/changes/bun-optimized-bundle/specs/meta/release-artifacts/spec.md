## ADDED Requirements

### Requirement: Release executables use the published slim runtime

The release workflow SHALL compile the `variant` executables with one job per supported platform, each compiling only that platform's executable, with the exact Bun version that `mise.toml` pins. For a Linux or macOS platform, the job SHALL, after installing the pinned tools and before compiling, try to download the zip `bun-slim-<os>-<arch>-v*.zip` from the newest release `bun-slim-v<X.Y.Z>-<N>` of `github.com/jubr/bun-slim`, where `<X.Y.Z>` is the Bun version `mise.toml` pins and `<N>` is the highest build number released for it. The job SHALL check the zip against the `SHA256SUMS` of that release and SHALL compile with `VARIANT_BUN_RUNTIME` naming the `bun-slim` executable in the zip. When no release exists for the pinned version, the download fails, or the checksum does not match, the job SHALL print a warning, SHALL compile with the default runtime that ships with Bun, and SHALL NOT fail for that reason. A Windows job SHALL NOT fetch a slim runtime and SHALL NOT set `VARIANT_BUN_RUNTIME`. The release workflow SHALL NOT build Bun. The release assets, their names, and the checksum file SHALL be the same as without this requirement.

#### Scenario: Release found

- **WHEN** `mise.toml` pins Bun `1.4.5`, `github.com/jubr/bun-slim` has the releases `bun-slim-v1.4.5-0` and `bun-slim-v1.4.5-1`, and the Linux x64 job runs
- **THEN** that job downloads `bun-slim-linux-x64-v1.4.5-1.zip` and `SHA256SUMS` from `bun-slim-v1.4.5-1`, and compiles with `VARIANT_BUN_RUNTIME` naming the `bun-slim` executable in that zip

#### Scenario: No release for the pinned version

- **WHEN** `mise.toml` pins a Bun version for which `github.com/jubr/bun-slim` has no release and a Linux or macOS job runs
- **THEN** that job prints a warning, compiles with the default runtime, and succeeds

#### Scenario: Checksum mismatch

- **WHEN** the downloaded zip does not match its entry in `SHA256SUMS`
- **THEN** that job prints a warning, compiles with the default runtime, and succeeds

#### Scenario: Windows

- **WHEN** the Windows x64 or Windows arm64 job runs
- **THEN** it does not fetch a slim runtime and does not set `VARIANT_BUN_RUNTIME`

#### Scenario: Same assets

- **WHEN** every platform job succeeds
- **THEN** the release assets are the two `.vsix` files, six `variant` executables named `variant-<version>-<os>-<arch>[.exe]`, and `SHA256SUMS`
