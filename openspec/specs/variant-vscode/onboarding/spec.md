# variant-vscode/onboarding Specification

## Purpose

Onboarding in the editor: a dialog that initializes Variant in the workspace, shown in the Variant Worktrees section of
the Explorer, reachable from a command and offered once by a notification when the workspace looks ready for Variant.

## Requirements

### Requirement: Onboarding command and dialog

The command `variant.onboardingInit` (title `Variant: Initialize in this Repo`) SHALL show the initialization dialog in
the Variant Worktrees section of the Explorer: the section SHALL show the dialog in place of the variants list while
the dialog is open, be revealed, expanded and focused (the Explorer opens when it is hidden), and take the most space
the host allows a section; running the command again SHALL focus that section. The dialog SHALL fit a narrow sidebar
and scroll when it is taller than the section. It SHALL show intro text, the extension icon small at the top right,
three checkboxes, all checked, labelled `Write variants.yaml with autodetected values`, `Add _v-* to .gitignore` (the
pattern follows the prefix as it is typed) and `Augment mise.toml with variant-cli`, a collapsed disclosure labelled
`Advanced` immediately above the buttons, and the buttons `Cancel` and `Initialize`. The disclosure SHALL contain the
text input `Prefix` holding `_v-`, and SHALL be collapsed until the person opens it. No button in the dialog SHALL be
labelled `Init`. `Cancel` SHALL close the dialog and show the variants list again, changing nothing. `Initialize` SHALL
run the `init` command of `variant-api` in-process with the typed prefix and the checkbox choices, then close the
dialog, show the variants list, open the written `variants.yaml` in the editor and show a confirmation naming what each
step did; the list SHALL then reflect the new configuration. An empty prefix or one with a path separator SHALL disable
`Initialize` and show the reason outside the disclosure, including while `Advanced` is collapsed. A failure of a step
SHALL show its message in the dialog and leave it open; a step the command reports as unchanged (already present) is
not a failure. When the workspace already has a `variants.yaml`, the first checkbox SHALL be unchecked and disabled
with that explanation. The webview SHALL load nothing from outside the extension's own files and SHALL use a content
security policy with a per-load nonce and the editor theme variables.

#### Scenario: Open

- **WHEN** the command runs in a workspace without `variants.yaml`
- **THEN** the Variant Worktrees section is expanded and focused and shows the intro, the icon at the top right,
  three checked checkboxes, a collapsed `Advanced`, and the buttons `Cancel` and `Initialize`
- **AND** `Prefix` is not shown until `Advanced` is opened

#### Scenario: Advanced holds the prefix

- **WHEN** a person opens `Advanced`
- **THEN** it shows `Prefix` with `_v-`, and the disclosure sits immediately above the buttons

#### Scenario: Explorer hidden

- **WHEN** the sidebar is closed and the command runs
- **THEN** the Explorer opens with the dialog focused

#### Scenario: Run again

- **WHEN** the command runs while the dialog is open
- **THEN** the section is focused and no second dialog appears

#### Scenario: Init

- **WHEN** a person presses `Initialize` with the defaults
- **THEN** `variants.yaml` is written, `.gitignore` gains `_v-*`, the mise configuration lists the CLI, the file opens in the
  editor, and the section shows the variants list again

#### Scenario: Prefix changed

- **WHEN** a person opens `Advanced` and types `wt-` as the prefix
- **THEN** the second label reads `Add wt-* to .gitignore` and `Initialize` writes `variant.prefix: wt-`

#### Scenario: Unchecked step

- **WHEN** a person unchecks the `.gitignore` checkbox and presses `Initialize`
- **THEN** `.gitignore` is not changed

#### Scenario: Invalid prefix

- **WHEN** the prefix is empty or holds `/`
- **THEN** `Initialize` is disabled and the reason is shown even if `Advanced` is collapsed

#### Scenario: Step fails

- **WHEN** the mise configuration is not valid and a person presses `Initialize`
- **THEN** the dialog stays open with that message, and `variants.yaml` and `.gitignore` have been written

#### Scenario: Cancel

- **WHEN** a person presses `Cancel`
- **THEN** the variants list is shown again and no file changed

#### Scenario: Existing configuration

- **WHEN** the workspace has a `variants.yaml`
- **THEN** the first checkbox is unchecked and disabled and `Initialize` only handles `.gitignore` and the mise configuration

#### Scenario: Restricted content

- **WHEN** the dialog HTML is generated
- **THEN** it has a content security policy that allows scripts only with the nonce

### Requirement: One-time onboarding notification

The extension SHALL show an information notification `Detected <detected>, want to bootstrap Variant in this repo?`
with the button `Bootstrap Variant` when a commit is made locally while the extension runs and adoption of the
workspace is `detected` ([specs/variant-config/adoption](../../variant-config/adoption/spec.md)). `<detected>` SHALL be
that result's label. The button SHALL run `variant.onboardingInit`. A commit is local when the newest entry of the
`HEAD` reflog is a `commit` entry (including the initial commit and amends); pulls, merges, rebases, checkouts and
clones SHALL NOT count, and commits that exist when the editor starts SHALL NOT trigger it. The notification SHALL show
at most once per workspace: showing it records that, whatever the person answers, and the record SHALL persist across
editor restarts.

#### Scenario: Offered after a commit

- **WHEN** the workspace has no `variants.yaml`, `mise.local.toml` defines `POSTGRES_HOST`, a Vite app exists, and a
  person commits
- **THEN** the notification `Detected postgres+vite, want to bootstrap Variant in this repo?` appears with
  `Bootstrap Variant`

#### Scenario: Button opens the dialog

- **WHEN** a person presses `Bootstrap Variant`
- **THEN** the dialog of `variant.onboardingInit` shows in the Explorer

#### Scenario: SQLite and a watch script

- **WHEN** `SQLITE_DATABASE` is set, only a package with a `watch` script exists and a person commits
- **THEN** the notification names `sqlite+package-script-watch`

#### Scenario: MariaDB

- **WHEN** `MARIADB_HOST` is set, a NestJS app exists and a person commits
- **THEN** the notification names `mariadb+nestjs`

#### Scenario: MySQL

- **WHEN** `MYSQL_HOST` is set, a Vite app exists and a person commits
- **THEN** the notification names `mysql+vite`

#### Scenario: Only once

- **WHEN** the notification was shown, dismissed, and another commit is made, including after a restart
- **THEN** no second notification appears

#### Scenario: Existing configuration

- **WHEN** adoption is `active`
- **THEN** a commit shows no notification

#### Scenario: Nothing detected

- **WHEN** adoption is `none` and reading the environment did not fail
- **THEN** a commit shows no notification and records nothing

#### Scenario: Mise fails

- **WHEN** reading the Mise environment fails, for example because its configuration is untrusted
- **THEN** a commit shows no onboarding notification and records nothing, and the Mise failure is reported as specified in [specs/tools/mise](../../tools/mise/spec.md) (Mise failures in the editor offer Trust), and after a successful `Trust` the check runs again

#### Scenario: Not a local commit

- **WHEN** the newest `HEAD` reflog entry is a pull, merge, rebase, checkout or clone
- **THEN** no notification appears

#### Scenario: Existing commits at startup

- **WHEN** the editor starts in a repository whose newest reflog entry is a commit
- **THEN** no notification appears until a new commit is made

#### Scenario: Command ignores the gates

- **WHEN** a person runs `variant.onboardingInit` after the notification was shown or without a commit
- **THEN** the dialog shows

### Requirement: Detection focuses the Explorer section

When the one-time onboarding notification is shown, the extension SHALL expand the Explorer **Variant Worktrees** section and focus it. It SHALL NOT focus the activity-bar **Variant Worktrees** container. `variant.autoExpand` set to `false` SHALL NOT prevent this focus. A commit that does not show the notification SHALL NOT focus the section because of that commit. Starting `variant.onboardingInit` SHALL focus the initialization dialog in that section, as specified by **Onboarding command and dialog**, including when the person presses `Bootstrap Variant`.

#### Scenario: Notification focuses the section

- **WHEN** the one-time onboarding notification is shown
- **THEN** the Explorer **Variant Worktrees** section is expanded and focused
- **AND** the activity-bar container is not focused

#### Scenario: Auto-expand off still focuses

- **WHEN** `variant.autoExpand` is `false` and the notification is shown
- **THEN** the Explorer section is expanded and focused

#### Scenario: No notification does not focus

- **WHEN** a commit does not show the notification
- **THEN** that commit does not focus the Explorer section

#### Scenario: Command still focuses the dialog

- **WHEN** a person runs `variant.onboardingInit`, including by pressing `Bootstrap Variant`
- **THEN** the initialization dialog is focused in the Explorer section

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
