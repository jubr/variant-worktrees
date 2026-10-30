## Purpose

Lets users tab-complete the `variant` CLI in their shell by generating a completion script for `zsh`, `bash`, or `fish` from the CLI's own command definitions.

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

`variant completions` SHALL fail when `<shell>` is missing or is not one of `zsh`, `bash`, `fish`. The error message SHALL name the supported shells, nothing SHALL be written to stdout, and the exit code SHALL be non-zero.

#### Scenario: Unknown shell

- **WHEN** a user runs `variant completions powershell`
- **THEN** stderr names `zsh`, `bash`, and `fish`
- **AND** stdout is empty and the exit code is non-zero

#### Scenario: Missing shell

- **WHEN** a user runs `variant completions`
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
