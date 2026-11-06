## ADDED Requirements

### Requirement: Init runs in the main checkout

When the opened workspace folder has no `.git` directory, onboarding SHALL use the main checkout as its directory. That checkout SHALL be the directory that contains the `.vscode` directory returned by the main-checkout resolution in [specs/variant-config/core | Main .vscode directory](../../variant-config/core/spec.md#requirement-main-vscode-directory), [specs/variant-config/core | Linked checkout container](../../variant-config/core/spec.md#requirement-linked-checkout-container), and [specs/variant-config/core | Single repo holding worktrees](../../variant-config/core/spec.md#requirement-single-repo-holding-worktrees). A `.git` entry that is a file SHALL NOT count as a `.git` directory. `init`, the check for an existing `variants.yaml`, adoption, and the one-time commit notification SHALL use that directory. When the workspace folder has a `.git` directory, those SHALL use the workspace folder. When that resolution returns the workspace folder's own `.vscode`, `init` SHALL run in the workspace folder and SHALL NOT create a checkout.

#### Scenario: Variant root

- **WHEN** the workspace folder is `/work/vw`, that folder has no `.git` entry, `/work/vw/AGENTS.md` is a symlink to `/work/vw/variant-worktrees/AGENTS.md`, and a person presses `Initialize` with the defaults
- **THEN** `variants.yaml` is written in `/work/vw/variant-worktrees`, `.gitignore` there gains `_v-*`, and the mise configuration of that checkout lists the CLI
- **AND** `/work/vw` gains no `variants.yaml`, `.gitignore` line, or mise entry from this action

#### Scenario: Linked worktree

- **WHEN** the workspace folder is `/work/vw/_v-lib`, its `.git` is a file, `/work/vw/AGENTS.md` is a symlink to `/work/vw/variant-worktrees/AGENTS.md`, and a person presses `Initialize` with the defaults
- **THEN** those files are written in `/work/vw/variant-worktrees`
- **AND** `/work/vw/_v-lib` is unchanged

#### Scenario: Worktree of a single repo

- **WHEN** the workspace folder is `/work/_v-lib`, its `.git` is a file, `/work` has a `.git` directory and a regular `AGENTS.md`, and a person presses `Initialize` with the defaults
- **THEN** those files are written in `/work`
- **AND** `/work/_v-lib` is unchanged

#### Scenario: Main checkout

- **WHEN** the workspace folder is `/work/vw/variant-worktrees` and that folder contains a `.git` directory
- **THEN** `Initialize` writes in `/work/vw/variant-worktrees`

#### Scenario: No separate checkout

- **WHEN** the workspace folder has no `.git` directory and main-checkout resolution returns that folder's `.vscode`
- **THEN** `Initialize` writes in the workspace folder

#### Scenario: Existing file is the checkout's file

- **WHEN** the workspace folder is `/work/vw` with the symlink layout above and `/work/vw/variant-worktrees/variants.yaml` exists
- **THEN** the first checkbox is unchecked and disabled
- **AND** the absence of `/work/vw/variants.yaml` does not leave that checkbox enabled

#### Scenario: Notification follows the checkout

- **WHEN** the workspace folder is `/work/vw` with the symlink layout, adoption of the main checkout is `detected`, and a person commits in that checkout
- **THEN** the onboarding notification appears
- **AND** no commit in `/work/vw` is required
