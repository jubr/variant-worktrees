# variant-cli/completions Specification

## Purpose

Lets users tab-complete the `variant` CLI in their shell by generating a completion script for `zsh`, `bash`, or `fish` from the CLI's own command definitions, and completes variant slugs from local variant state.

## Requirements

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

Every generated script SHALL complete the following for `variant`: each subcommand of the CLI, including `ui` and `completions` themselves; for each subcommand, its flags and their short aliases, including the global output flags `--json` and `--yaml` on the lifecycle subcommands; the global flags `--help` and `--version`; and the values `zsh`, `bash`, `fish` as the argument of `completions`. Where the shell supports completion descriptions (`zsh`, `fish`), each subcommand SHALL be offered with its description. The set of completed subcommands and flags SHALL be the set the CLI accepts, so a command or flag added to the CLI is completed without a separate update.

#### Scenario: Subcommands completed

- **WHEN** the script for any supported shell is generated
- **THEN** it contains every subcommand name the CLI lists in `variant --help`

#### Scenario: Flags per subcommand

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `--slug` and `-s` for `create`, `--detach` for `watch` and `ui`, `--stop` for `ui`, and `--force` for `implode`
- **AND** it offers `--verbose` and `-v`, `--json`, and `--yaml` for every lifecycle subcommand

#### Scenario: Flags are not offered on other subcommands

- **WHEN** the script for any supported shell is generated
- **THEN** it does not offer `--detach` or `--stop` for `list`, `create`, `status`, or `completions`, nor `--json` for `ui` or `completions`
- **AND** it does not offer `--table`, which the CLI no longer has

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

The script SHALL keep the candidates in variables of the running shell only. It SHALL NOT write a cache file, a marker, or any other file, and nothing SHALL outlive the shell session. The remembered list belongs to the directory it was gathered in and SHALL NOT be offered in another directory. A list is fresh for 30 seconds after it was gathered.

In `zsh` and in `bash` 4.1 or newer, the script SHALL prefetch: a completion request at any position of a `variant` command line SHALL start gathering in the background when no fresh list exists for the current directory, so the list is ready by the time the user completes a slug. The prefetch SHALL NOT delay the completion in progress, SHALL NOT print anything, and SHALL NOT leave a job number or completion notice in the shell. At a slug position the script SHALL offer the remembered list immediately, even when it is no longer fresh, and start gathering again in that case. When no list is remembered yet, it SHALL wait for the gathering already under way, or gather synchronously when none is, so the first slug completion is never empty because of the prefetch.

In `fish` and in `bash` older than 4.1 (such as the `bash` 3.2 of macOS), which cannot hand a background result to the running shell without a file, the script SHALL NOT prefetch. At a slug position it SHALL offer the remembered list while fresh, and otherwise gather synchronously, remember the result, and offer it.

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

- **WHEN** a script was generated before variant `new-one` was created and the remembered list is older than 30 seconds
- **THEN** in `zsh` and `bash` 4.1 or newer, completing `variant up --slug ` offers the remembered list and starts gathering, and the next `variant up --slug ` completion offers `new-one`
- **AND** in `fish` and older `bash`, completing `variant up --slug ` gathers again and offers `new-one`

#### Scenario: First completion prefetches in the background

- **WHEN** a user of `zsh` or `bash` 4.1 or newer completes `variant ` for the first time in a directory
- **THEN** the subcommands are offered without waiting for the slug listing
- **AND** the slugs of that directory's project are gathered in the background and remembered in the shell

#### Scenario: Prefetched list used at a slug position

- **WHEN** the background gathering has finished and the user then completes `variant up -s `
- **THEN** the slugs are offered from the remembered list and `variant` is not started for the answer

#### Scenario: Slug completion before any prefetch

- **WHEN** no list is remembered and the user completes `variant up -s ` as the very first completion
- **THEN** the slugs are gathered (waiting for a gathering under way, or running one) and offered

#### Scenario: Gathering in flight at a slug position

- **WHEN** a background gathering has started but not finished and no list is remembered
- **THEN** the slug completion waits for that gathering and offers its slugs, without starting a second one

#### Scenario: Stale list offered while gathering again

- **WHEN** the remembered list is older than 30 seconds and a `zsh` or `bash` 4.1 or newer user completes `variant up -s `
- **THEN** the remembered slugs are offered without delay
- **AND** gathering starts again in the background

#### Scenario: Fresh list is not gathered again

- **WHEN** the remembered list is younger than 30 seconds
- **THEN** a completion request does not start `variant`

#### Scenario: Remembered per directory

- **WHEN** a list was gathered in directory `A` and the user completes `variant up -s ` in directory `B`
- **THEN** the list of `A` is not offered

#### Scenario: Fish gathers on demand

- **WHEN** a `fish` user completes `variant up -s ` twice within 30 seconds in one directory
- **THEN** `variant` is started once, for the first completion

#### Scenario: Prefetch leaves the shell untouched

- **WHEN** a completion request starts a background gathering
- **THEN** nothing is printed to the terminal and the shell shows no job number or completion notice

#### Scenario: No files are written

- **WHEN** a user completes slugs in any supported shell
- **THEN** the script has created no file and no directory

### Requirement: Slug listing

`variant completions --list-slugs` SHALL print the slugs of existing variants to stdout, one per line, sorted and without duplicates, and SHALL print only valid slugs (lowercase letters and digits separated by single hyphens), and SHALL exit with code 0; `<shell>` SHALL NOT be required with it. A variant exists for this purpose when it has a saved variant state, or when a directory named with `variant.prefix` exists below `variant.root` (the slug is the name without the prefix). The listing SHALL NOT connect to a database and SHALL NOT create or modify any file or directory. Without a `variants.yaml` it SHALL use the autodetected settings, as `variant list` does. When the configuration is invalid, it SHALL print nothing and exit with code 0.

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

#### Scenario: No configuration file

- **WHEN** no `variants.yaml` exists and a `_v-add-auth` directory exists in the autodetected root
- **THEN** `add-auth` is printed and the exit code is 0

#### Scenario: Invalid configuration

- **WHEN** the configuration file is invalid
- **THEN** stdout is empty, stderr is empty, and the exit code is 0
