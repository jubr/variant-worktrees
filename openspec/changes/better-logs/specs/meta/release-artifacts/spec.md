## ADDED Requirements

### Requirement: Patch version bump

The repository SHALL provide `task version:incr:patch`, which increments the patch number of the root package and of every `packages/*` package, and writes the same version to the workspace entries in `bun.lock`. It SHALL print the new version. It SHALL change nothing and fail when the packages do not share one version, or when that version is not plain `major.minor.patch`.

#### Scenario: Versions agree

- **WHEN** the root package and every `packages/*` package declare `1.2.3` and the task runs
- **THEN** each of those `package.json` files and each `packages/*` entry in `bun.lock` declares `1.2.4`, and the task prints `1.2.4`

#### Scenario: Versions differ

- **WHEN** any package declares a version different from the others
- **THEN** the task fails, names the packages and their versions, and no file changes
