## ADDED Requirements

### Requirement: Init runs in the main checkout

When the opened workspace folder has no `.git` directory, onboarding SHALL choose a checkout and use it as its directory. A `.git` entry that is a file SHALL NOT count as a `.git` directory. The choice SHALL be:

1. The directory of the real file behind an `AGENTS.md` symlink in the workspace folder, when that directory contains a `.git` entry and no other rule names a different directory. A missing `variants.yaml` SHALL NOT reject this directory.
2. When directories inside the workspace are git worktrees of one repository, the primary worktree of that repository (the first path `git worktree list` reports). A single such directory SHALL be that checkout.
3. When rule 1 and rule 2 name different directories, or more than one directory contains a `.git` entry and neither rule names a single checkout, onboarding SHALL show a dialog listing those directories. The person SHALL pick one. That directory is the checkout. Cancel SHALL write nothing and SHALL leave the workspace folder as the directory.

`init`, the check for an existing `variants.yaml`, adoption, and the one-time commit notification SHALL use the chosen directory. Detection for `init` SHALL run in that directory. When the workspace folder has a `.git` directory, those SHALL use the workspace folder. When no directory containing `.git` is found, `init` SHALL run in the workspace folder.

#### Scenario: Variant root

- **WHEN** the workspace folder is `/work/vw`, that folder has no `.git` entry, `/work/vw/AGENTS.md` is a symlink to `/work/vw/variant-worktrees/AGENTS.md`, `/work/vw/variant-worktrees` contains `.git`, and a person presses `Initialize` with the defaults
- **THEN** `variants.yaml` is written in `/work/vw/variant-worktrees`, `.gitignore` there gains `_v-*`, and the mise configuration of that checkout lists the CLI
- **AND** `/work/vw` gains no `variants.yaml`, `.gitignore` line, or mise entry from this action
- **AND** no directory dialog is shown

#### Scenario: Symlink wins without variants.yaml

- **WHEN** the layout is the variant root above and `/work/vw/variant-worktrees` has no `variants.yaml`
- **THEN** the chosen directory is still `/work/vw/variant-worktrees`

#### Scenario: Sibling worktrees

- **WHEN** the workspace folder is `/work/vw`, it has no `AGENTS.md` symlink and no `.git` entry, `/work/vw/app` and `/work/vw/_v-lib` are worktrees of one repository, and `git worktree list` names `/work/vw/app` first
- **THEN** `Initialize` writes in `/work/vw/app`
- **AND** no directory dialog is shown

#### Scenario: Linked worktree

- **WHEN** the workspace folder is `/work/vw/_v-lib`, its `.git` is a file, and `git worktree list` names `/work/vw/variant-worktrees` first
- **THEN** those files are written in `/work/vw/variant-worktrees`
- **AND** `/work/vw/_v-lib` is unchanged

#### Scenario: Worktree of a single repo

- **WHEN** the workspace folder is `/work/_v-lib`, its `.git` is a file, and `git worktree list` names `/work` first
- **THEN** those files are written in `/work`
- **AND** `/work/_v-lib` is unchanged

#### Scenario: Main checkout

- **WHEN** the workspace folder is `/work/vw/variant-worktrees` and that folder contains a `.git` directory
- **THEN** `Initialize` writes in `/work/vw/variant-worktrees`
- **AND** no directory dialog is shown

#### Scenario: No checkout

- **WHEN** the workspace folder has no `.git` directory and neither it nor a directory inside it contains a `.git` entry
- **THEN** `Initialize` writes in the workspace folder
- **AND** no directory dialog is shown

#### Scenario: Doubt lists the directories

- **WHEN** the workspace folder has no `.git` directory, no `AGENTS.md` symlink, and two child directories each contain `.git` but are not worktrees of one repository
- **THEN** a dialog lists both directories and `Initialize` does not write until one is chosen

#### Scenario: Disagreeing answers

- **WHEN** an `AGENTS.md` symlink names `/work/vw/app` and the primary worktree is `/work/vw/other`
- **THEN** the dialog lists both directories

#### Scenario: Chosen directory

- **WHEN** the dialog is shown and a person chooses `/work/vw/app`
- **THEN** detection and `Initialize` run in `/work/vw/app`
- **AND** the other listed directory is unchanged

#### Scenario: Cancel the dialog

- **WHEN** a person cancels the directory dialog
- **THEN** no file is written and the workspace folder stays the directory

#### Scenario: Existing file is the checkout's file

- **WHEN** the workspace folder is `/work/vw` with the symlink layout above and `/work/vw/variant-worktrees/variants.yaml` exists
- **THEN** the first checkbox is unchecked and disabled
- **AND** the absence of `/work/vw/variants.yaml` does not leave that checkbox enabled

#### Scenario: Notification follows the checkout

- **WHEN** the workspace folder is `/work/vw` with the symlink layout, adoption of the chosen checkout is `detected`, and a person commits in that checkout
- **THEN** the onboarding notification appears
- **AND** no commit in `/work/vw` is required
