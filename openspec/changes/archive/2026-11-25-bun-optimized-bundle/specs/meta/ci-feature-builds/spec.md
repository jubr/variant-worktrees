## MODIFIED Requirements

### Requirement: Extension packages on feature branches

The CI workflow SHALL, in the same run, package both extensions as `.vsix` files and attach them to the run as downloadable artifacts. It SHALL NOT attach a `variant` executable. Its one compile of the `variant` executable is the one that "Slim runtime available for the pinned Bun" requires, and that executable is run only for the smoke test.

#### Scenario: Packages build

- **WHEN** the CI workflow succeeds
- **THEN** the run has artifacts containing the variant-worktrees `.vsix` and the chat-renamer `.vsix`
- **AND** the run has no `variant` executable

#### Scenario: Packaging failure fails the build

- **WHEN** a `.vsix` cannot be packaged
- **THEN** the CI workflow fails

## ADDED Requirements

### Requirement: Slim runtime available for the pinned Bun

The job of the CI workflow that runs the library and the CLI SHALL compile the `variant` executable for `bun-linux-x64` with `task package:cli` and SHALL run `variant --version` from it. The job SHALL fail when the details line does not name the slim runtime of the Bun version `mise.toml` pins (`bun-slim-v<X.Y.Z>-<N>`), so that a branch learns before a release does that `github.com/jubr/bun-slim` has no build of that version. The job SHALL NOT attach the executable to the run.

#### Scenario: Slim runtime published for the pinned version

- **WHEN** `mise.toml` pins Bun `1.4.5` and `github.com/jubr/bun-slim` has a release `bun-slim-v1.4.5-<N>`
- **THEN** the compiled executable prints a details line with `bun-slim-v1.4.5-<N>` and the job passes

#### Scenario: No slim runtime for the pinned version

- **WHEN** `mise.toml` pins a Bun version for which `github.com/jubr/bun-slim` has no release
- **THEN** the compile warns and embeds the default runtime, `variant --version` prints `bun-v<version>`, and the job fails
