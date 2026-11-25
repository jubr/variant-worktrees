# meta/bun-bump Specification

## Purpose
Keep every place that names the Bun version on one version, the one of the newest `github.com/jubr/bun-slim` release unless told otherwise, so the Bun that compiles `variant` and the slim runtime it embeds are the same release.

## Requirements

### Requirement: Bun version bump

The repository SHALL provide `task chore:bun:bump`, which moves every place that names the Bun version to one version and commits the result. The version SHALL be the `VERSION` variable (with or without a leading `v`) when it is non-empty, and otherwise the version of the newest release of `github.com/jubr/bun-slim`, without its build number (`bun-slim-v1.4.5-0` is `1.4.5`). The places are the `bun` pin of `mise.toml`, the `^` range of `@types/bun` in the root `package.json` and in every `packages/*/package.json` that has one (a `latest` range stays), and the Bun entries of `bun.lock`, which the task SHALL regenerate with that Bun version. The task SHALL end with the commit `chore(bun): bump to vX.Y.Z` that holds only those files. It SHALL fail without changing anything when `VERSION` is not a plain `major.minor.patch` version, or when `VERSION` is empty and the repository has no release. It SHALL commit nothing when every place already names that version.

#### Scenario: Latest release

- **WHEN** `VERSION` is empty, `github.com/jubr/bun-slim` has the releases `bun-slim-v1.4.5-0` and `bun-slim-v1.4.4-3`, and the task runs
- **THEN** `mise.toml` pins `bun` `1.4.5`, `@types/bun` is `^1.4.5` where it had a `^` range, `bun.lock` is regenerated, and the last commit is `chore(bun): bump to v1.4.5`

#### Scenario: Version override

- **WHEN** the task runs with `VERSION=1.4.6`
- **THEN** every place names `1.4.6` and the last commit is `chore(bun): bump to v1.4.6`, whether or not a release exists for it

#### Scenario: Not a version

- **WHEN** the task runs with `VERSION=1.4`
- **THEN** it exits non-zero, names the value, and changes and commits nothing

#### Scenario: Already there

- **WHEN** every place already names the version the task picked
- **THEN** the task prints that and makes no commit
