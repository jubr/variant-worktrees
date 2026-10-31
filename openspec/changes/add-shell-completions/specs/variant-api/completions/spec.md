## Purpose

Lets users tab-complete the `variant` CLI in their shell by generating a completion script for `zsh`, `bash`, or `fish` from the CLI's own command definitions, and completes variant slugs from local variant state.

## ADDED Requirements

### Requirement: Completions command

The CLI SHALL provide `variant completions <shell>`, where `<shell>` is `zsh`, `bash`, or `fish`. The command SHALL print the completion script for that shell to stdout and nothing else, and SHALL exit with code 0. It SHALL NOT require a configuration file, a database, a git repository, or a running extension, and SHALL NOT write any file. `completions` SHALL be listed in `variant --help` with a description.

#### Scenario: Print a zsh script

- **WHEN** a user runs `variant completions zsh`
- **THEN** stdout holds a zsh completion script for `variant`
- **AND** the exit code is 0

#### Scenario: Print a bash script

- **WHEN** a user runs `variant completions bash`
- **THEN** stdout holds a bash completion script for `variant`
- **AND** the exit code is 0

#### Scenario: Print a fish script

- **WHEN** a user runs `variant completions fish`
- **THEN** stdout holds a fish completion script for `variant`
- **AND** the exit code is 0

#### Scenario: Works outside a project

- **WHEN** a user runs `variant completions zsh` in a directory that is not a git repository and holds no `variants.yaml`
- **THEN** the script is printed and the exit code is 0

#### Scenario: Listed in help

- **WHEN** a user runs `variant --help`
- **THEN** the command list includes `completions` with its description

### Requirement: Unsupported shell

Unless `--list-slugs` is given, `variant completions` SHALL fail when `<shell>` is missing or is not one of `zsh`, `bash`, `fish`. The error message SHALL name the supported shells, nothing SHALL be written to stdout, and the exit code SHALL be non-zero.

#### Scenario: Unknown shell

- **WHEN** a user runs `variant completions powershell`
- **THEN** stderr names `zsh`, `bash`, and `fish`
- **AND** stdout is empty and the exit code is non-zero

#### Scenario: Missing shell

- **WHEN** a user runs `variant completions` without `--list-slugs`
- **THEN** stderr names `zsh`, `bash`, and `fish`
- **AND** stdout is empty and the exit code is non-zero

### Requirement: Completion coverage

Every generated script SHALL complete the following for `variant`: each subcommand of the CLI, including `completions` itself; for each subcommand, its flags and their short aliases, including CLI-only flags; the global flags `--help` and `--version`; and the values `zsh`, `bash`, `fish` as the argument of `completions`. Where the shell supports completion descriptions (`zsh`, `fish`), each subcommand SHALL be offered with its description. The set of completed subcommands and flags SHALL be the set the CLI accepts, so a command or flag added to the CLI is completed without a separate update.

#### Scenario: Subcommands completed

- **WHEN** the script for any supported shell is generated
- **THEN** it contains every subcommand name the CLI lists in `variant --help`

#### Scenario: Flags per subcommand

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `--slug` and `-s` for `create`, `--detach` for `watch`, `--force` for `implode`, and `--table` for `list`
- **AND** it offers `--verbose` for every lifecycle subcommand

#### Scenario: Flags are not offered on other subcommands

- **WHEN** the script for any supported shell is generated
- **THEN** it does not offer `--table` for `create`, nor `--detach` for `list`

#### Scenario: Global flags

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `--help` and `--version` for `variant`

#### Scenario: Shell names after completions

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `zsh`, `bash`, and `fish` as the argument of `variant completions`

#### Scenario: New command is completed

- **WHEN** a command definition is added to the CLI's command list
- **THEN** the generated scripts contain that command and its flags without any other source change

### Requirement: Generated scripts are loadable

Each script SHALL be loadable by its shell without errors: `zsh` as a `#compdef variant` completion function, `bash` by `source`, and `fish` by `source`. Loading SHALL NOT run the `variant` binary and SHALL NOT print output.

#### Scenario: Bash script loads

- **WHEN** a user runs `source <(variant completions bash)` in `bash`
- **THEN** the shell reports no error and prints nothing
- **AND** `complete -p variant` shows a completion registered for `variant`

#### Scenario: Fish script loads

- **WHEN** a user runs `variant completions fish | source` in `fish`
- **THEN** the shell reports no error and prints nothing
- **AND** `complete -c variant` lists the registered completions

#### Scenario: Zsh script loads

- **WHEN** a user runs `eval "$(variant completions zsh)"` in `zsh` after `compinit`
- **THEN** the shell reports no error and prints nothing
- **AND** `variant <TAB>` offers the subcommands

### Requirement: Slug completion

Every generated script SHALL complete the value of `--slug` and `-s`, and the positional slug, for each subcommand that takes a slug, with the slugs of existing variants. The candidates SHALL be gathered while the user is completing, not embedded in the script, so a variant created after the script was generated is offered.

The script SHALL prefetch the candidates: a completion request at any position of a `variant` command line SHALL start a refresh in the background when no fresh candidate list exists for the current directory, so the list is ready by the time the user completes a slug. A list is fresh for 30 seconds after it was gathered. The refresh SHALL NOT delay the completion in progress, SHALL NOT print anything, and SHALL NOT leave a job, job number, or completion notice in the user's shell. At a slug position the script SHALL offer the stored list immediately, even when it is no longer fresh, and start a refresh in that case; when no stored list exists yet, it SHALL gather the candidates synchronously so the first slug completion is never empty because of the prefetch. A stored list SHALL be replaced atomically, so a reader never sees a partial list, and SHALL be kept in a directory only the current user can read and write.

Subcommands that take no slug SHALL NOT be offered slug candidates. When the candidates cannot be gathered, the shell SHALL receive no candidates and the user SHALL see no error output.

#### Scenario: Slug flag value completed

- **WHEN** variants `add-auth` and `fix-login` exist and a user completes `variant up --slug ` or `variant up -s `
- **THEN** `add-auth` and `fix-login` are offered

#### Scenario: Positional slug completed

- **WHEN** variants `add-auth` and `fix-login` exist and a user completes `variant implode `
- **THEN** `add-auth` and `fix-login` are offered

#### Scenario: Prefix narrows candidates

- **WHEN** variants `add-auth` and `fix-login` exist and a user completes `variant down --slug ad`
- **THEN** `add-auth` is offered and `fix-login` is not

#### Scenario: Commands without a slug

- **WHEN** a user completes the arguments of `variant list`
- **THEN** no slug candidates are offered

#### Scenario: New variant offered without regenerating

- **WHEN** a script was generated before variant `new-one` was created and the stored list is older than 30 seconds
- **THEN** completing `variant up --slug ` may offer the stored list, which starts a refresh
- **AND** the next `variant up --slug ` completion offers `new-one`

#### Scenario: First completion prefetches in the background

- **WHEN** a user completes `variant ` for the first time in a directory and no stored list exists
- **THEN** the subcommands are offered without waiting for the slug listing
- **AND** a background refresh stores the slugs of that directory's project

#### Scenario: Prefetched list used at a slug position

- **WHEN** a background refresh has finished and the user then completes `variant up -s `
- **THEN** the slugs are offered from the stored list and `variant` is not started for the answer

#### Scenario: Slug completion before any prefetch

- **WHEN** no stored list exists and the user completes `variant up -s ` as the very first completion
- **THEN** the slugs are gathered synchronously and offered

#### Scenario: Stale list offered while refreshing

- **WHEN** the stored list is older than 30 seconds and the user completes `variant up -s `
- **THEN** the stored slugs are offered without delay
- **AND** a background refresh replaces the stored list

#### Scenario: Fresh list is not refreshed

- **WHEN** the stored list is younger than 30 seconds
- **THEN** a completion request does not start a refresh

#### Scenario: Refresh leaves the shell untouched

- **WHEN** a completion request starts a background refresh
- **THEN** nothing is printed to the terminal and the shell shows no job number or completion notice

#### Scenario: Stored list is private

- **WHEN** the script stores a list
- **THEN** the directory that holds it is readable and writable by the current user only

#### Scenario: Outside a project

- **WHEN** a user completes `variant up --slug ` in a directory that is not a git repository and holds no `variants.yaml`
- **THEN** no candidates are offered and nothing is printed to the terminal

### Requirement: Slug listing

`variant completions --list-slugs` SHALL print the slugs of existing variants to stdout, one per line, sorted and without duplicates, and SHALL print only valid slugs (lowercase letters and digits separated by single hyphens), and SHALL exit with code 0; `<shell>` SHALL NOT be required with it. A variant exists for this purpose when it has a saved variant state, or when a directory named with `variant.prefix` exists below `variant.root` (the slug is the name without the prefix). The listing SHALL NOT connect to a database and SHALL NOT create or modify any file or directory. When the configuration cannot be loaded, it SHALL print nothing and exit with code 0.

#### Scenario: State and worktrees combined

- **WHEN** a saved state exists for `add-auth` and the directory `_v-fix-login` exists below `variant.root`
- **THEN** `variant completions --list-slugs` prints `add-auth` and `fix-login`, one per line, sorted

#### Scenario: Same variant listed once

- **WHEN** both a saved state and a `_v-add-auth` directory exist for `add-auth`
- **THEN** `add-auth` is printed once

#### Scenario: Invalid names are skipped

- **WHEN** the directory `_v-bad name` or `_v-Upper` exists below `variant.root`
- **THEN** neither is printed, because a slug is lowercase letters, digits, and single hyphens

#### Scenario: Custom prefix

- **WHEN** `variant.prefix` is `wt-` and the directory `wt-add-auth` exists below `variant.root`
- **THEN** `add-auth` is printed

#### Scenario: No variants

- **WHEN** no state and no prefixed directory exist
- **THEN** stdout is empty and the exit code is 0

#### Scenario: No side effects

- **WHEN** the state directory does not exist and a user runs `variant completions --list-slugs`
- **THEN** the state directory is still absent afterwards
- **AND** no database connection is opened

#### Scenario: Unloadable configuration

- **WHEN** the configuration file is invalid or absent
- **THEN** stdout is empty, stderr is empty, and the exit code is 0
