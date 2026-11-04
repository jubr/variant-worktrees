## MODIFIED Requirements

### Requirement: Slug resolution

The system SHALL derive a slug from the git worktree or branch, or accept an explicit `-s/--slug` value. A branch name SHALL lose a leading `refs/heads/`, `feature/` and any of `variant.branchPrefixes` before it is lowered and reduced to `a-z0-9` words joined by `-`. An operation started in the primary checkout SHALL resolve to `main`. An operation started in a variant worktree SHALL resolve to that variant's slug. `${slug}` in a command of that operation SHALL expand to the same value. An operation started in the variant root SHALL NOT derive a slug from that directory. With an explicit slug, `create` and `watch` started there SHALL succeed.

#### Scenario: Primary worktree slug
- **WHEN** the current directory is the primary git worktree
- **THEN** the slug resolves to `main`

#### Scenario: Feature worktree slug
- **WHEN** the current directory is a worktree on branch `feat/add-auth`
- **THEN** the slug resolves to `add-auth`

#### Scenario: Explicit slug override
- **WHEN** the CLI receives `--slug preview-one`
- **THEN** the slug is `preview-one` and git detection is skipped

#### Scenario: No git repository
- **WHEN** the current directory is not a git worktree, not the variant root, and no `--slug` value is provided
- **THEN** the system returns an error with a usage hint

#### Scenario: Configured branch prefix
- **WHEN** `variant.branchPrefixes` is `["task/"]` and the worktree is on branch `task/add-auth`
- **THEN** the slug resolves to `add-auth`

#### Scenario: Slug from the main checkout
- **WHEN** an operation with a command that prints `${slug}` is started in the primary checkout and no slug is given
- **THEN** the slug is `main` and the command prints `main`

#### Scenario: Slug from a variant directory
- **WHEN** an operation with a command that prints `${slug}` is started in the worktree on branch `feat/add-auth` and no slug is given
- **THEN** the slug is `add-auth` and the command prints `add-auth`

#### Scenario: Root workspace needs an explicit slug
- **WHEN** the current directory is the variant root and no slug is given
- **THEN** the system returns an error with a usage hint and does not inspect git in the variant root

### Requirement: Worktree coupling

The system SHALL create `_v-<slug>` worktrees below the resolved `variant.root` with `git worktree add` in the resolved `variant.main` when variant operations require it, and reuse one that exists. Variant operations SHALL NOT change the working directory of the process. A new worktree SHALL start a branch named with the first of `variant.branchPrefixes` from `variant.baseBranch`, unless a branch named with any configured prefix already exists, which SHALL be checked out instead. When the root is the main tree or lies inside it and a `.gitignore` exists there, creating a worktree SHALL add the line `<prefix>*` (for example `_v-*`) to that `.gitignore` unless a line already ignores it (`<prefix>*` or `/<prefix>*`, with or without a trailing `/`; a comment does not count). The system SHALL NOT create a `.gitignore` and SHALL NOT change one when the root is outside the main tree. When the process working directory is the variant root, `create`, `watch`, `down`, and `implode` of an explicit slug SHALL inspect git in the resolved `variant.main` and SHALL NOT fail because the variant root is not a git checkout. They SHALL NOT need a `variants.yaml` in the variant root. `watch` of a slug other than `main` SHALL run each watch command, and the provisioning command of each watch, with the watch's `dir` resolved against that slug's worktree. `watch` of `main` SHALL run in the primary checkout. `implode` SHALL remove the worktree through `variant.main`. `${slug}` in those commands SHALL expand to the explicit slug.

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
