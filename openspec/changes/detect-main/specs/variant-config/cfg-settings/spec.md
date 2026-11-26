## MODIFIED Requirements

### Requirement: Branch naming settings
The system SHALL accept an optional `variant.baseBranch`, a non-empty string naming the branch that new variant branches start from and that a variant must be merged into before it is imploded. When it is not set, the resolved value SHALL be the default branch of the main checkout (`variant.main`) detected from local git state, and `main` when none is detected. Detection SHALL NOT fetch and SHALL NOT contact a remote, and SHALL take the first of these that exists: the branch that `refs/remotes/origin/HEAD` points at; the branch named by the git setting `init.defaultBranch`, when that local branch exists; the local branch `main`; the local branch `master`; the branch the checkout has checked out, including a branch that has no commit yet. The detected value SHALL be the plain branch name (`master`, not `origin/master`), also when it contains `/`. A configured `variant.baseBranch` SHALL be used as it is and SHALL NOT be detected over. The system SHALL accept an optional `variant.branchPrefixes`, a non-empty list of strings that each end in `/`, defaulting to `["feat/", "fix/"]`. The first entry SHALL prefix the branch of a new variant worktree. Every entry, and `feature/`, SHALL be removed from a branch name when a slug is derived from it. The resolved configuration SHALL always carry both settings.

#### Scenario: Defaults

- **WHEN** `variants.yaml` defines neither option and the repository has a local `main`
- **THEN** the resolved base branch is `main` and the resolved prefixes are `feat/` and `fix/`

#### Scenario: Custom values

- **WHEN** `variant.baseBranch` is `develop` and `variant.branchPrefixes` is `["task/"]`
- **THEN** the resolved configuration carries exactly those values

#### Scenario: Invalid prefix

- **WHEN** an entry of `variant.branchPrefixes` is empty or does not end in `/`
- **THEN** loading the configuration fails validation

#### Scenario: Repository with master

- **WHEN** `variant.baseBranch` is not set and the repository has the local branch `master`, no `main`, no remote and no `init.defaultBranch`
- **THEN** the resolved base branch is `master`

#### Scenario: Remote default branch

- **WHEN** `variant.baseBranch` is not set, `refs/remotes/origin/HEAD` points at `origin/develop`, and a local `main` also exists
- **THEN** the resolved base branch is `develop`

#### Scenario: Branch name with a slash

- **WHEN** `variant.baseBranch` is not set and `origin/HEAD` points at `origin/release/2`
- **THEN** the resolved base branch is `release/2`

#### Scenario: Configured default branch

- **WHEN** `variant.baseBranch` is not set, `init.defaultBranch` is `trunk`, the local branch `trunk` exists, there is no `origin/HEAD`, and a local `main` also exists
- **THEN** the resolved base branch is `trunk`

#### Scenario: Configured branch does not exist

- **WHEN** `variant.baseBranch` is not set, `init.defaultBranch` is `trunk`, no local `trunk` exists, and the local branch `master` exists
- **THEN** the resolved base branch is `master`

#### Scenario: Repository without commits

- **WHEN** `variant.baseBranch` is not set and the repository was made with `git init -b trunk` and has no commit
- **THEN** the resolved base branch is `trunk`

#### Scenario: Explicit value wins

- **WHEN** `variant.baseBranch` is `release` and `origin/HEAD` points at `origin/develop`
- **THEN** the resolved base branch is `release`

#### Scenario: Nothing detected

- **WHEN** `variant.baseBranch` is not set and the main checkout is not in a git repository
- **THEN** the resolved base branch is `main`

#### Scenario: No network

- **WHEN** `variant.baseBranch` is not set and the command runs without network access in a clone whose `origin/HEAD` is set
- **THEN** the branch is detected and the remote is not contacted

#### Scenario: Create works without init

- **WHEN** the repository's only branch is `master`, `variants.yaml` does not set `variant.baseBranch`, and a person runs `variant create -s demo`
- **THEN** the worktree is created from `master`

#### Scenario: Config shows the origin

- **WHEN** the base branch was detected and a person runs `variant config`
- **THEN** the printed configuration shows the resolved `variant.baseBranch` and a comment that it was detected, and names the signal
