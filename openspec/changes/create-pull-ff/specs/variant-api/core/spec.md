## ADDED Requirements

### Requirement: Fast-forward the start branch

When `pullFf` is set and the operation creates a new variant branch, the system SHALL fast-forward the start branch to its upstream before the worktree is added, and that new branch SHALL start at the updated tip. The start branch SHALL be the branch named by `from` when `from` names a branch, and SHALL be `variant.baseBranch` otherwise. When that branch is checked out in a worktree of the repository, the fast-forward SHALL run in that checkout and SHALL restore local changes stashed for the update. When that branch is checked out in no worktree, the fast-forward SHALL update the branch ref from its upstream and SHALL NOT change the files of any existing worktree. The system SHALL NOT pull the new variant branch. The system SHALL NOT create a merge commit on the start branch. When the start branch has no upstream, has diverged from its upstream, or the update fails, the operation SHALL fail and SHALL leave no new branch and no new worktree. The error SHALL name the failure, SHALL say how to repair the checkout that was updated, and SHALL include one runnable `variant` command that repeats the same operation, including `--pull-ff`, the slug, and `from` when `from` was set. When `from` names a tag or a commit, `pullFf` SHALL NOT fetch and the new branch SHALL start at that commit. When an existing worktree for the slug is reused, or an existing branch under any configured prefix is checked out, `pullFf` SHALL NOT move that branch and SHALL NOT contact the remote. When the slug resolves to `main`, `pullFf` SHALL NOT fetch and SHALL NOT pull. When `pullFf` is omitted, the operation SHALL NOT fetch and SHALL NOT pull. The fast-forward SHALL NOT change the working directory of the process.

#### Scenario: Checked-out base branch is fast-forwarded first

- **WHEN** the primary checkout is on `main`, `main` tracks `origin/main`, `origin/main` is ahead of `main`, and `create("add-auth", { pullFf: true })` creates a branch
- **THEN** `main` in the primary checkout is fast-forwarded to `origin/main` before the worktree exists
- **AND** `feat/add-auth` HEAD is that updated tip
- **AND** the working directory of the process is unchanged

#### Scenario: Caller is not on the start branch

- **WHEN** the process working directory is a feature worktree, the primary checkout is on `main`, `origin/main` is ahead of `main`, and `create("add-auth", { pullFf: true })` creates a branch
- **THEN** the primary checkout is fast-forwarded
- **AND** the new worktree is not pulled
- **AND** `feat/add-auth` HEAD is the updated tip of `main`

#### Scenario: Local changes are restored

- **WHEN** the primary checkout is on `main` with local modifications, `origin/main` is a fast-forward of `main`, and `create("add-auth", { pullFf: true })` creates a branch
- **THEN** those modifications are present in the primary checkout after the call
- **AND** `feat/add-auth` HEAD is the updated tip of `main`

#### Scenario: Start branch is not checked out

- **WHEN** `main` is checked out in no worktree, `main` tracks `origin/main`, `origin/main` is ahead of `main`, and `create("add-auth", { pullFf: true })` creates a branch from `main`
- **THEN** the local `main` ref is the tip of `origin/main`
- **AND** no existing worktree's files change before the new worktree is added
- **AND** `feat/add-auth` HEAD is that tip

#### Scenario: From a checked-out branch

- **WHEN** `from` is `feat/other`, that branch is checked out in a worktree, its upstream is ahead of it, and `create("add-auth", { pullFf: true, from: "feat/other" })` creates a branch
- **THEN** that checkout is fast-forwarded to its upstream
- **AND** `feat/add-auth` HEAD is that updated tip
- **AND** the new worktree's branch is not pulled

#### Scenario: Tag or commit skips the fetch

- **WHEN** `from` names a tag or a commit, `pullFf` is set, and `create("add-auth", { pullFf: true, from })` creates a branch
- **THEN** no fetch runs
- **AND** `feat/add-auth` HEAD is that commit

#### Scenario: Diverged start branch aborts

- **WHEN** `main` has commits that are not in its upstream and `create("add-auth", { pullFf: true })` would create a branch
- **THEN** the call fails
- **AND** branch `feat/add-auth` does not exist and the worktree directory does not exist
- **AND** the error names the divergence and includes a runnable `variant create` command with `--pull-ff` and the slug `add-auth`

#### Scenario: Missing upstream aborts

- **WHEN** `main` has no upstream and `create("add-auth", { pullFf: true })` would create a branch
- **THEN** the call fails before a branch or worktree exists
- **AND** the error says that `main` has no upstream and includes a runnable `variant create` command with `--pull-ff` and the slug `add-auth`

#### Scenario: Failed update names the repair

- **WHEN** the fast-forward of a checked-out start branch fails
- **THEN** the call fails with no new branch and no new worktree
- **AND** the error names that checkout, says how to repair it, and includes the runnable `variant` command that repeats the call

#### Scenario: Retry command keeps from

- **WHEN** `variant create --pull-ff --from feat/other --slug demo` fails while fast-forwarding `feat/other`
- **THEN** the error includes one runnable line containing `variant create`, `--pull-ff`, `--from feat/other`, and the slug `demo`

#### Scenario: Existing worktree ignores pullFf

- **WHEN** a worktree for `add-auth` already exists and `create("add-auth", { pullFf: true })` runs
- **THEN** that worktree is reused and its HEAD is unchanged
- **AND** no fetch runs

#### Scenario: Existing prefixed branch ignores pullFf

- **WHEN** branch `fix/add-auth` already exists and `create("add-auth", { pullFf: true })` runs
- **THEN** the worktree checks out `fix/add-auth` at that branch's existing HEAD
- **AND** no fetch runs

#### Scenario: Main slug does not pull

- **WHEN** the slug resolves to `main` and `pullFf` is set
- **THEN** no worktree is created
- **AND** no fetch runs

#### Scenario: Omitted pullFf does not fetch

- **WHEN** `origin/main` is ahead of local `main` and `create("add-auth")` creates a branch
- **THEN** local `main` stays at its previous tip
- **AND** `feat/add-auth` HEAD is that previous tip

#### Scenario: Implied commands fast-forward

- **WHEN** `provision("add-auth", { pullFf: true })`, `up("add-auth", { pullFf: true })`, or `watch("add-auth", { pullFf: true })` creates a branch and the start branch's upstream is ahead
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip
