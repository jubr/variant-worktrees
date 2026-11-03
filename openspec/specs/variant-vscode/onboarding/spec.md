# variant-vscode/onboarding Specification

## Purpose

Onboarding in the editor: a dialog that initializes Variant in the workspace, shown in the Variant Worktrees section of
the Explorer, reachable from a command and offered once by a notification when the workspace looks ready for Variant.

## Requirements

### Requirement: Onboarding command and dialog

The command `variant.onboardingInit` (title `Variant: Initialize in this Repo`) SHALL show the initialization dialog in
the Variant Worktrees section of the Explorer: the section SHALL show the dialog in place of the variants tree while
the dialog is open, be revealed, expanded and focused (the Explorer opens when it is hidden), and take the most space
the host allows a section; running the command again SHALL focus that section. The dialog SHALL fit a narrow sidebar
and scroll when it is taller than the section. It SHALL show intro text, the extension icon small at the top right, a
text input `Prefix` holding `_v-`, three checkboxes, all checked, labelled `Write variants.yaml with autodetected
values`, `Add _v-* to .gitignore` (the pattern follows the prefix as it is typed) and `Augment mise.toml with
variant-cli`, and the buttons `Cancel` and `Init`. `Cancel` SHALL close the dialog and show the variants tree again,
changing nothing. `Init` SHALL run the `init` command of `variant-api` in-process with the typed prefix and the
checkbox choices, then close the dialog, show the variants tree, open the written `variants.yaml` in the editor and
show a confirmation naming what each step did; the tree SHALL then reflect the new configuration. An empty prefix or
one with a path separator SHALL disable `Init` and show the reason. A failure of a step SHALL show its message in the
dialog and leave it open; a step the command reports as unchanged (already present) is not a failure. When the
workspace already has a `variants.yaml`, the first checkbox SHALL be unchecked and disabled with that explanation.
The webview SHALL load nothing from outside the extension's own files and SHALL use a content security policy with a
per-load nonce and the editor theme variables.

#### Scenario: Open

- **WHEN** the command runs in a workspace without `variants.yaml`
- **THEN** the Variant Worktrees section is expanded and focused and shows the intro, the icon at the top right,
  `Prefix` with `_v-`, three checked checkboxes, and the buttons `Cancel` and `Init`

#### Scenario: Explorer hidden

- **WHEN** the sidebar is closed and the command runs
- **THEN** the Explorer opens with the dialog focused

#### Scenario: Run again

- **WHEN** the command runs while the dialog is open
- **THEN** the section is focused and no second dialog appears

#### Scenario: Init

- **WHEN** a person presses `Init` with the defaults
- **THEN** `variants.yaml` is written, `.gitignore` gains `_v-*`, the mise configuration lists the CLI, the file opens in the
  editor, and the section shows the variants tree again

#### Scenario: Prefix changed

- **WHEN** a person types `wt-` as the prefix
- **THEN** the second label reads `Add wt-* to .gitignore` and `Init` writes `variant.prefix: wt-`

#### Scenario: Unchecked step

- **WHEN** a person unchecks the `.gitignore` checkbox and presses `Init`
- **THEN** `.gitignore` is not changed

#### Scenario: Invalid prefix

- **WHEN** the prefix is empty or holds `/`
- **THEN** `Init` is disabled and the reason is shown

#### Scenario: Step fails

- **WHEN** the mise configuration is not valid and a person presses `Init`
- **THEN** the dialog stays open with that message, and `variants.yaml` and `.gitignore` have been written

#### Scenario: Cancel

- **WHEN** a person presses `Cancel`
- **THEN** the variants tree is shown again and no file changed

#### Scenario: Existing configuration

- **WHEN** the workspace has a `variants.yaml`
- **THEN** the first checkbox is unchecked and disabled and `Init` only handles `.gitignore` and the mise configuration

#### Scenario: Restricted content

- **WHEN** the dialog HTML is generated
- **THEN** it has a content security policy that allows scripts only with the nonce

### Requirement: One-time onboarding notification

The extension SHALL show an information notification `Detected <detected>, want to bootstrap Variant in this repo?`
with the button `Bootstrap Variant` when a commit is made locally while the extension runs and all of these hold: no
`variants.yaml` or `variants.yml` is found for the workspace root; a database is detected from the Mise or process environment
([specs/tools/mise](../../tools/mise/spec.md)), with dialect `postgres`, `mysql` (MySQL or MariaDB) or `sqlite` (the SQLite fallback used when nothing is
detected does not count); and at least one application is detected: a Vite app, a NestJS app, or a package whose
`package.json` has a watch-like script. `<detected>` SHALL be the database and the distinct application kinds joined by
`+`, in the order `vite`, `nestjs`, `package-script-watch`, for example `postgres+vite`; a database detected through
MariaDB is named `mariadb`. The button SHALL run `variant.onboardingInit`. A commit is local when the newest entry of
the `HEAD` reflog is a `commit` entry (including the initial commit and amends); pulls, merges, rebases, checkouts and
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

- **WHEN** a `variants.yaml` is found for the workspace root
- **THEN** a commit shows no notification

#### Scenario: Nothing detected

- **WHEN** no database, or no application, is detected
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
