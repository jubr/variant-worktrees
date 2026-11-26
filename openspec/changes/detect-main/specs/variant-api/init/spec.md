## ADDED Requirements

### Requirement: Init writes the default branch

`variant init` SHALL write `variant.baseBranch` into `variants.yaml` as the default branch it detects for the directory it acts on, by the rules of [specs/variant-config/cfg-settings | Branch naming settings](../../../variant-config/cfg-settings/spec.md#requirement-branch-naming-settings): local git state only, no fetch, and the plain branch name. It SHALL write the value also when it is `main`. The line SHALL carry a comment on the same line that names the signal that found it: `from origin/HEAD`, `from init.defaultBranch`, `local branch`, or `checked out`. When no branch is detected (the directory is not in a git repository, or `HEAD` is detached and no candidate exists) `init` SHALL write no `variant.baseBranch`, so the default of the configuration applies. The result SHALL name the written branch as `detected.baseBranch`, `null` when none was written, and the text output SHALL show it. The written file SHALL still pass the validation of any `variants.yaml`.

#### Scenario: Remote default branch

- **WHEN** `refs/remotes/origin/HEAD` points at `origin/develop`, a local `main` also exists, and a person runs `variant init`
- **THEN** the file has `baseBranch: develop # from origin/HEAD`
- **AND** `detected.baseBranch` is `develop`

#### Scenario: Repository with master

- **WHEN** the repository has the local branch `master`, no `main`, no remote and no `init.defaultBranch`
- **THEN** the file has `baseBranch: master # local branch`

#### Scenario: Configured default branch

- **WHEN** `init.defaultBranch` is `trunk`, the local branch `trunk` exists, there is no `origin/HEAD`
- **THEN** the file has `baseBranch: trunk # from init.defaultBranch`

#### Scenario: Repository without commits

- **WHEN** `git init -b trunk` was run and nothing was committed
- **THEN** the file has `baseBranch: trunk # checked out`

#### Scenario: Default branch is main

- **WHEN** the repository's default branch is `main`
- **THEN** the file has `baseBranch: main`

#### Scenario: No git repository

- **WHEN** the directory is not inside a git repository
- **THEN** the file has no `baseBranch` and `detected.baseBranch` is `null`
- **AND** `init` succeeds

#### Scenario: Text output

- **WHEN** init writes `variants.yaml` with a detected branch
- **THEN** the detected line of the text output shows `branch <name>`

#### Scenario: Create works afterwards

- **WHEN** `init` ran in a repository whose only branch is `master` and a person then runs `variant create -s demo`
- **THEN** the worktree is created from `master`
