## MODIFIED Requirements

### Requirement: Completion coverage

Every generated script SHALL complete the following for `variant`: each subcommand of the CLI, including `ui` and `completions` themselves; for each subcommand, its flags and their short aliases, including the global output flags `--json` and `--yaml` on the lifecycle subcommands; the global flags `--help` and `--version`; the short option `-C` for `variant` and for every subcommand, including `ui` and `completions`; and the values `zsh`, `bash`, `fish` as the argument of `completions`. The scripts SHALL NOT offer `--chdir`. Where the shell supports completion descriptions (`zsh`, `fish`), each subcommand SHALL be offered with its description. The set of completed subcommands and flags SHALL be the set the CLI accepts, so a command or flag added to the CLI is completed without a separate update.

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

#### Scenario: Directory option

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `-C` for `variant`, for `list`, for `ui`, and for `completions`
- **AND** it does not offer `--chdir`

#### Scenario: Shell names after completions

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `zsh`, `bash`, and `fish` as the argument of `variant completions`

#### Scenario: New command is completed

- **WHEN** a command definition is added to the CLI's command list
- **THEN** the generated scripts contain that command and its flags without any other source change
