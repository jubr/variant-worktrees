## MODIFIED Requirements

### Requirement: Slug completion

Every generated script SHALL complete the value of `--slug` and `-s` for each subcommand that takes a slug, with the slugs of existing variants. The candidates SHALL be gathered while the user is completing, not embedded in the script, so a variant created after the script was generated is offered.

The script SHALL keep the candidates in variables of the running shell only. It SHALL NOT write a cache file, a marker, or any other file, and nothing SHALL outlive the shell session. The remembered list belongs to the directory it was gathered in and SHALL NOT be offered in another directory. A list is fresh for 30 seconds after it was gathered.

In `zsh` and in `bash` 4.1 or newer, the script SHALL prefetch: a completion request at any position of a `variant` command line SHALL start gathering in the background when no fresh list exists for the current directory, so the list is ready by the time the user completes a slug. The prefetch SHALL NOT delay the completion in progress, SHALL NOT print anything, and SHALL NOT leave a job number or completion notice in the shell. At a slug position the script SHALL offer the remembered list immediately, even when it is no longer fresh, and start gathering again in that case. When no list is remembered yet, it SHALL wait for the gathering already under way, or gather synchronously when none is, so the first slug completion is never empty because of the prefetch.

In `fish` and in `bash` older than 4.1 (such as the `bash` 3.2 of macOS), which cannot hand a background result to the running shell without a file, the script SHALL NOT prefetch. At a slug position it SHALL offer the remembered list while fresh, and otherwise gather synchronously, remember the result, and offer it.

Subcommands that take no slug SHALL NOT be offered slug candidates. When the candidates cannot be gathered, the shell SHALL receive no candidates and the user SHALL see no error output.

#### Scenario: Slug flag value completed

- **WHEN** variants `add-auth` and `fix-login` exist and a user completes `variant up --slug ` or `variant up -s `
- **THEN** `add-auth` and `fix-login` are offered

#### Scenario: Positional slug completed

- **WHEN** variants `add-auth` and `fix-login` exist and a user completes `variant implode `
- **THEN** no slug candidate is offered (a slug is no longer a positional argument), and `-s` and `--slug` are among the flags offered

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

### Requirement: Completion coverage

Every generated script SHALL complete the following for `variant`: each subcommand of the CLI, including `ui` and `completions` themselves; for each subcommand, its flags and their short aliases, including the global output flags `--json` and `--yaml` on the lifecycle subcommands; the global flags `--help` and `--version`; the short option `-C` for `variant` and for every subcommand, including `ui` and `completions`; and the values `zsh`, `bash`, `fish` as the argument of `completions`. The scripts SHALL NOT offer `--chdir`. Where the shell supports completion descriptions (`zsh`, `fish`), each subcommand SHALL be offered with its description. The set of completed subcommands and flags SHALL be the set the CLI accepts, so a command or flag added to the CLI is completed without a separate update.

#### Scenario: Subcommands completed

- **WHEN** the script for any supported shell is generated
- **THEN** it contains every subcommand name the CLI lists in `variant --help`

#### Scenario: Flags per subcommand

- **WHEN** the script for any supported shell is generated
- **THEN** it offers `--slug` and `-s` for `create`, `--detach` for `watch` and `ui`, `--stop` for `ui`, and `--force` for `implode`
- **AND** it offers `--verbose` (and not `-v`, which is a global log-level flag), `--json`, and `--yaml` for every lifecycle subcommand

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
