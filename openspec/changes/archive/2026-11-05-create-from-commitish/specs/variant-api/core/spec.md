## MODIFIED Requirements

### Requirement: Worktree coupling

The system SHALL create `_v-<slug>` worktrees below the resolved `variant.root` with `git worktree add` in the resolved `variant.main` when variant operations require it, and reuse one that exists. Variant operations SHALL NOT change the working directory of the process. A new worktree SHALL start a branch named with the first of `variant.branchPrefixes` from the commit-ish given as `from` when the operation sets `from`, and otherwise from `variant.baseBranch`, unless a branch named with any configured prefix already exists, which SHALL be checked out instead. `from` SHALL be a branch, tag, or commit that git can resolve in the repository of `variant.main`. A relative name such as `HEAD` SHALL be the HEAD of the process working directory when that directory is a worktree of that repository, and otherwise the HEAD of `variant.main`. When `from` is set and git cannot resolve it, the operation SHALL fail and SHALL leave no new branch and no new worktree. An existing worktree for the slug SHALL be reused, and `from` SHALL NOT move its branch. `from` SHALL NOT change the branch `implode` uses as its merge base. When the root is the main tree or lies inside it and a `.gitignore` exists there, creating a worktree SHALL add the line `<prefix>*` (for example `_v-*`) to that `.gitignore` unless a line already ignores it (`<prefix>*` or `/<prefix>*`, with or without a trailing `/`; a comment does not count). The system SHALL NOT create a `.gitignore` and SHALL NOT change one when the root is outside the main tree. When the process working directory is the variant root, `create`, `watch`, `down`, and `implode` of an explicit slug SHALL inspect git in the resolved `variant.main` and SHALL NOT fail because the variant root is not a git checkout. They SHALL NOT need a `variants.yaml` in the variant root. `watch` of a slug other than `main` SHALL run each watch command, and the provisioning command of each watch, with the watch's `dir` resolved against that slug's worktree. `watch` of `main` SHALL run in the primary checkout. `implode` SHALL remove the worktree through `variant.main`. `${slug}` in those commands SHALL expand to the explicit slug.

#### Scenario: Ensure worktree on create
- **WHEN** `create("add-auth")` is called from the primary worktree
- **THEN** `_v-add-auth` is created on `feat/add-auth` below the resolved root and the result holds its path
- **AND** the working directory of the process is unchanged

#### Scenario: Main slug stays in primary
- **WHEN** the slug resolves to `main`
- **THEN** no worktree is created and the process stays in the primary checkout

#### Scenario: Worktree uses resolved variant root
- **WHEN** `create("add-auth")` requires a worktree and `variant.root` resolves to `/workspace`
- **THEN** the worktree path is `/workspace/_v-add-auth`

#### Scenario: Worktree created from the main tree
- **WHEN** `variant.main` is `/work/app`, the process runs in `/elsewhere`, and `create("add-auth")` requires a worktree
- **THEN** the worktree is added to the repository of `/work/app`

#### Scenario: Watch from the repository with the workspace layout
- **WHEN** `watch("foo")` runs from `/work/app` and `/work/AGENTS.md` is a symlink into it
- **THEN** the worktree `/work/_v-foo` is created on `feat/foo` from `variant.baseBranch`

#### Scenario: Create from the variant root
- **WHEN** `create("foo")` runs in `/work`, `/work` is not a git checkout and has no `variants.yaml`, `/work/AGENTS.md` is a symlink to `/work/app/AGENTS.md`, and `/work/app/variants.yaml` is a real file
- **THEN** the worktree `/work/_v-foo` is created
- **AND** the call does not fail with `Unable to inspect git worktree from /work`

#### Scenario: Watch from the variant root
- **WHEN** `watch("foo")` runs in that same `/work` and `/work/_v-foo` is already a worktree of `/work/app` for slug `foo`
- **THEN** git is inspected in `/work/app`
- **AND** a watch whose `dir` is `be` and whose command prints `${slug}` runs in `/work/_v-foo/be` and prints `foo`

#### Scenario: Main from the variant root
- **WHEN** `watch("main")` runs from `/work` in that layout
- **THEN** it runs in `/work/app` and does not inspect git in `/work`

#### Scenario: Implode from the variant root
- **WHEN** `implode("foo")` runs from `/work` in that layout and the merge gate allows removal
- **THEN** the worktree is removed through the repository at `/work/app`
- **AND** the call does not fail with `Unable to inspect git worktree from /work`

#### Scenario: Configured base branch and prefix
- **WHEN** `variant.baseBranch` is `develop`, `variant.branchPrefixes` is `["task/"]` and `create("add-auth")` requires a worktree
- **THEN** branch `task/add-auth` is created from `develop`

#### Scenario: Existing branch with another configured prefix
- **WHEN** `variant.branchPrefixes` is `["feat/", "fix/"]` and branch `fix/add-auth` already exists
- **THEN** the worktree checks out `fix/add-auth`

#### Scenario: Worktree inside the main tree is git-ignored
- **WHEN** the root is the main tree, its `.gitignore` exists without an entry for `_v-*`, and a worktree is created
- **THEN** `.gitignore` ends with the line `_v-*`

#### Scenario: Ignore entry already present
- **WHEN** the root is the main tree and its `.gitignore` already has the line `_v-*` (or `/_v-*`)
- **THEN** `.gitignore` is unchanged, also after a second worktree is created

#### Scenario: No gitignore file
- **WHEN** the root is the main tree and no `.gitignore` exists
- **THEN** none is created

#### Scenario: Worktree outside the main tree
- **WHEN** the root is the directory that holds the main tree
- **THEN** no `.gitignore` is changed

#### Scenario: Create from a commit-ish
- **WHEN** `create("add-auth", { from })` requires a worktree, no branch under `variant.branchPrefixes` exists for that slug, and `from` resolves to a commit other than the tip of `variant.baseBranch`
- **THEN** branch `feat/add-auth` is created with that commit as its HEAD

#### Scenario: Provision from a commit-ish
- **WHEN** `provision("add-auth", { from })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the new branch HEAD is the commit `from` resolves to

#### Scenario: Up from a commit-ish
- **WHEN** `up("add-auth", { from })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the new branch HEAD is the commit `from` resolves to

#### Scenario: Watch from a commit-ish
- **WHEN** `watch("add-auth", { from })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the new branch HEAD is the commit `from` resolves to

#### Scenario: HEAD is the current worktree
- **WHEN** the process working directory is a worktree of the repository whose HEAD is commit C, and `create("add-auth", { from: "HEAD" })` creates a branch
- **THEN** the new branch HEAD is C

#### Scenario: HEAD outside a checkout
- **WHEN** the process working directory is not a worktree of the repository, `variant.main` HEAD is commit M, and `create("add-auth", { from: "HEAD" })` creates a branch
- **THEN** the new branch HEAD is M

#### Scenario: Existing branch ignores from
- **WHEN** branch `fix/add-auth` already exists and `create("add-auth", { from })` runs with `from` resolving to a different commit
- **THEN** the worktree checks out `fix/add-auth` at that branch's existing HEAD

#### Scenario: Existing worktree ignores from
- **WHEN** a worktree for `add-auth` already exists and `create("add-auth", { from })` runs
- **THEN** that worktree is reused and its HEAD is unchanged

#### Scenario: Unknown commit-ish
- **WHEN** `create("add-auth", { from: "no-such-commit" })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the call fails
- **AND** branch `feat/add-auth` does not exist and the worktree directory does not exist

#### Scenario: From does not move the implode base
- **WHEN** a variant branch was created with `from` set to a commit that is not an ancestor of `variant.baseBranch`
- **THEN** `implode` of that slug without `force` still refuses because the work is not merged into `variant.baseBranch`
