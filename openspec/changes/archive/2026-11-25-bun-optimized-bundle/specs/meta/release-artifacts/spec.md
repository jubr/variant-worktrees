## ADDED Requirements

### Requirement: Release executables use the published slim runtime

The release workflow SHALL compile the `variant` executables with one job per supported platform, each compiling only that platform's executable, with the exact Bun version that `mise.toml` pins. Each job SHALL run `task package:cli` for its platform, which chooses the runtime as `meta/dev-bleeds` describes. For a Linux or macOS platform that is the zip `bun-slim-<os>-<arch>-v*.zip` from the newest release `bun-slim-v<X.Y.Z>-<N>` of `github.com/jubr/bun-slim`, where `<X.Y.Z>` is the Bun version `mise.toml` pins and `<N>` is the highest build number released for it, checked against the `SHA256SUMS` of that release. The job SHALL give that task a `GH_TOKEN`. When no release exists for the pinned version, the download fails, or the checksum does not match, the job SHALL print a warning, SHALL compile with the default runtime that ships with Bun, and SHALL NOT fail for that reason. A Windows job SHALL NOT fetch a slim runtime. No job SHALL set `VARIANT_BUN_RUNTIME` and no step other than `task package:cli` SHALL fetch. The release workflow SHALL NOT build Bun. The release assets, their names, and the checksum file SHALL be the same as without this requirement.

#### Scenario: Release found

- **WHEN** `mise.toml` pins Bun `1.4.5`, `github.com/jubr/bun-slim` has the releases `bun-slim-v1.4.5-0` and `bun-slim-v1.4.5-1`, and the Linux x64 job runs
- **THEN** that job downloads `bun-slim-linux-x64-v1.4.5-1.zip` and `SHA256SUMS` from `bun-slim-v1.4.5-1`, and compiles with the `bun-slim` executable in that zip

#### Scenario: No release for the pinned version

- **WHEN** `mise.toml` pins a Bun version for which `github.com/jubr/bun-slim` has no release and a Linux or macOS job runs
- **THEN** that job prints a warning, compiles with the default runtime, and succeeds

#### Scenario: Checksum mismatch

- **WHEN** the downloaded zip does not match its entry in `SHA256SUMS`
- **THEN** that job prints a warning, compiles with the default runtime, and succeeds

#### Scenario: Windows

- **WHEN** the Windows x64 or Windows arm64 job runs
- **THEN** it does not fetch a slim runtime, and `task package:cli` prints that Windows has no slim runtime

#### Scenario: Same assets

- **WHEN** every platform job succeeds
- **THEN** the release assets are the two `.vsix` files, six `variant` executables named `variant-<version>-<os>-<arch>[.exe]`, and `SHA256SUMS`

### Requirement: Release executables report their sizes

Each job of the release workflow that compiles a `variant` executable SHALL write a Markdown table for its platform to the job's step summary. The table SHALL give, in KB (1 KB = 1024 bytes), the size of the default runtime that ships with Bun (`bun-dist`), of the slim runtime and the percentage it is smaller, the code bundle the compile added (the executable minus the runtime inside it), `bun-dist` plus that bundle, the compiled `variant`, and the percentage it is smaller than that sum. A size that cannot be determined, and the slim columns of a Windows job, SHALL show a dash. The step SHALL NOT fail the job.

#### Scenario: Linux or macOS job

- **WHEN** a Linux or macOS job compiled with the slim runtime
- **THEN** its step summary has the table with every column filled

#### Scenario: Windows job

- **WHEN** a Windows job ran
- **THEN** its table shows dashes for the slim runtime and its saving, and `0.0%` for the saving of the executable

#### Scenario: Size source unavailable

- **WHEN** the size of `bun-dist` cannot be fetched
- **THEN** the step prints a warning, the table shows dashes for what depends on it, and the job succeeds

