## Purpose

How Variant finds and uses [Mise](https://mise.jdx.dev): locating its executable, reading the environment through it,
reporting where a variable is defined, augmenting a project's Mise configuration with the CLI, and fixing Mise failures
from the editor. The library, the CLI, the MCP server and the extension share this behavior.

## ADDED Requirements

### Requirement: Mise executable resolution

The system SHALL offer `resolveMiseBinary` in `variant-config` that locates the Mise executable, trying in order: (1)
the path the caller passes, which the VS Code extension fills from its setting `variant.mise.binPath`; (2) the key
`variant.mise.binPath` of `variants.yaml`; (3) the directories of `PATH`; (4) these usual locations:
`/opt/homebrew/bin/mise`, `/usr/local/bin/mise`, `/usr/bin/mise`, `/home/linuxbrew/.linuxbrew/bin/mise`,
`~/.local/bin/mise`, `~/.local/share/mise/bin/mise`, `~/.cargo/bin/mise`, and on Windows `%LOCALAPPDATA%\mise\bin\mise.exe`
(places an editor started from the desktop often has not got on its `PATH`). It SHALL return the first executable
found, or nothing. A path from (1) or (2) that is not an executable file SHALL fail with an error that names where it
came from (the setting or the key) and the path, rather than fall through. A relative `variant.mise.binPath` in
`variants.yaml` SHALL be resolved against the directory of that file. Every use of Mise by the system (environment,
variable sources, configuration listing, trust) SHALL use the resolved executable, which SHALL be computed once per
loaded configuration. The extension setting `variant.mise.binPath` SHALL have a default of empty and a description
that names Mise; changing it SHALL apply to the next call without a reload.

#### Scenario: Editor setting first

- **WHEN** the setting `variant.mise.binPath` is `/opt/tools/mise` (executable), `variants.yaml` sets another path and another `mise` is on `PATH`
- **THEN** the resolved executable is `/opt/tools/mise`

#### Scenario: Configuration key before PATH

- **WHEN** no editor path is passed, `variants.yaml` sets `variant.mise.binPath: /opt/tools/mise` and another `mise` is on `PATH`
- **THEN** the resolved executable is `/opt/tools/mise`

#### Scenario: PATH

- **WHEN** no path is configured anywhere and `mise` is on `PATH`
- **THEN** that executable is resolved

#### Scenario: Usual location

- **WHEN** no path is configured, `PATH` has no `mise`, and `/opt/homebrew/bin/mise` is executable
- **THEN** `/opt/homebrew/bin/mise` is resolved

#### Scenario: Not found

- **WHEN** none of the places holds an executable
- **THEN** the result is nothing and no error occurs

#### Scenario: Bad editor path

- **WHEN** the setting `variant.mise.binPath` names a file that does not exist
- **THEN** resolving fails naming the setting and the path

#### Scenario: Bad configuration key

- **WHEN** `variants.yaml` sets `variant.mise.binPath: ./missing`
- **THEN** resolving fails naming the key and the path resolved against the file

#### Scenario: Changed setting

- **WHEN** the editor setting changes while the editor runs
- **THEN** the next call uses the new path

### Requirement: Environment read through Mise

The system SHALL obtain environment values for autodetection and interpolation by running `mise -C <configDir> env
--dotenv --quiet` once, parsing its dotenv output, and merging the result over the process environment (a value from
Mise wins). It SHALL NOT read Mise configuration files for values. The run SHALL happen lazily: only when a database
value, or a `${NAME}` reference of a setting that is being used, is first needed, never at the load of the
configuration alone, and at most once per loaded configuration. A command that needs no environment value (for
example `list` with a configuration that has no references and no `db` use) SHALL start no Mise process. The behavior
SHALL be the same for the library, the CLI, the MCP server and the extension. When no Mise executable is found the
process environment SHALL be used alone. When Mise exits with an error (an invalid or untrusted configuration) the
system SHALL fail with a Mise error that names the directory, carries Mise's message, and is marked `untrusted` when
that message says that configuration files are not trusted, rather than continue with other values.

#### Scenario: One run for many values

- **WHEN** `db.password` is `${POSTGRES_PASSWORD}`, `db.host` is detected, and a step env value has `${JWT_SECRET}`
- **THEN** `mise env --dotenv --quiet` runs once for the loaded configuration

#### Scenario: Lazy

- **WHEN** `variant list` runs for a configuration without environment references
- **THEN** no Mise process starts

#### Scenario: Mise wins over the process environment

- **WHEN** Mise and the process both define `POSTGRES_HOST`
- **THEN** the detected host is the Mise value

#### Scenario: Any official Mise file

- **WHEN** the variables are defined in `.config/mise.toml` or `mise/config.toml` instead of `mise.local.toml`
- **THEN** they are detected as they would be from `mise.local.toml`

#### Scenario: Mise not installed

- **WHEN** no Mise executable is found and `POSTGRES_HOST` is in the process environment
- **THEN** the detected host is that value and no error occurs

#### Scenario: Mise fails

- **WHEN** `mise env` exits with an error for an invalid configuration
- **THEN** a command that needs an environment value fails naming the directory and Mise's message

#### Scenario: Untrusted configuration

- **WHEN** `mise env` exits with "Config files in /proj/mise.toml are not trusted"
- **THEN** the error is marked `untrusted` and names `/proj`

### Requirement: Variable sources

The system SHALL find the files that define variables with `mise -C <configDir> set --raw --quiet`, which lists each
variable with its source file (home directory abbreviated as `~`, which SHALL be expanded). The lookup SHALL run only
for callers that report a source (`variant init`), and a variable that Mise does not list SHALL be reported as coming
from the process environment.

#### Scenario: Source file

- **WHEN** `mise set` lists `POSTGRES_PASSWORD` with the source `~/proj/mise.local.toml`
- **THEN** the source of `POSTGRES_PASSWORD` is the `mise.local.toml` in the home directory's `proj`, with `~` expanded

#### Scenario: Process environment

- **WHEN** `mise set` does not list `DATABASE_URL`
- **THEN** it has no source file

### Requirement: Augmenting the Mise configuration

The system SHALL offer, in `variant-api` for every caller, a step that makes the Mise configuration of a directory list
the tool `github:jubr/variant-worktrees` with the version `latest`, the entry `mise use github:jubr/variant-worktrees`
would add, without installing anything. The file SHALL be chosen by taking the entries of `mise -C <dir> config ls
--json`, keeping only those inside the git checkout of the directory (the directory itself when it is not in a
checkout), dropping those with `.local.` in the file name, and taking the first, the closest by directory. Any file
name and location that Mise supports qualifies (`mise.toml`, `.mise.toml`, `mise/config.toml`, `.mise/config.toml`,
`.config/mise.toml`, and the like). When none remains, `mise.toml` SHALL be created in the directory with a `[tools]`
table. In the chosen file the entry SHALL be added to its `[tools]` table without changing any other line, a `[tools]`
table SHALL be added when there is none, and nothing SHALL change when the tool is already listed. A file that is not
valid, or that defines `tools` in a form that cannot be extended in place, SHALL be left unchanged and the result
SHALL say why. When no Mise executable is found the step SHALL change nothing and report that Mise was not found, the
places searched, and the editor setting and configuration key `variant.mise.binPath`.

#### Scenario: Created

- **WHEN** `mise config ls` lists no file inside the checkout
- **THEN** `mise.toml` is created with `[tools]` and `"github:jubr/variant-worktrees" = "latest"`

#### Scenario: Added to existing tools

- **WHEN** `mise.toml` has `[tools]` with `node = "22"` and an `[env]` table
- **THEN** the new entry is added to `[tools]` and every other line is unchanged

#### Scenario: Other official file

- **WHEN** the only configuration file is `.config/mise.toml` with a `[tools]` table
- **THEN** the entry is added there and no `mise.toml` is created

#### Scenario: Local files dropped

- **WHEN** `mise config ls` lists `mise.local.toml` first and `mise.toml` second, both in the checkout
- **THEN** only `mise.toml` changes

#### Scenario: Closest file

- **WHEN** `mise config ls` lists `app/mise.toml` first and `mise.toml` of the checkout root second, and the step runs in `app`
- **THEN** only `app/mise.toml` changes

#### Scenario: Ancestor in the checkout

- **WHEN** the step runs in `app`, which has no configuration, and the checkout root has `mise.toml`
- **THEN** the entry is added to the `mise.toml` of the checkout root

#### Scenario: Outside the checkout

- **WHEN** the only other listed files are the global configuration and a `.mise.toml` above the checkout
- **THEN** neither is changed and `mise.toml` is created in the directory

#### Scenario: No tools table

- **WHEN** `mise.toml` has only `[env]`
- **THEN** a `[tools]` table with the entry is appended

#### Scenario: Already listed

- **WHEN** the configuration already lists `github:jubr/variant-worktrees`
- **THEN** no file is changed and the result says so

#### Scenario: Invalid file

- **WHEN** the chosen file is not valid TOML
- **THEN** it is unchanged and the result names the problem

#### Scenario: Mise missing

- **WHEN** no Mise executable is found
- **THEN** nothing changes and the result says that Mise was not found, names the places searched and `variant.mise.binPath`

### Requirement: Mise failures in the editor offer Trust

When a call of the extension fails with a Mise error, the extension SHALL show an error notification that names the
directory and carries Mise's message, one per directory and failure kind per editor session. When the error is marked
`untrusted` the notification SHALL have the button `Trust`. Pressing it SHALL run `mise -C <dir> trust --all` with the
resolved executable, then repeat the action that failed (the onboarding check, the variants view refresh, or the
`Init` of the onboarding dialog), and show a confirmation naming the directory. A failure of the trust command SHALL
show its message and retry nothing. A missing Mise executable is not a failure of a call; a feature that needs Mise
(the Mise step of `Init`) SHALL say that Mise was not found and name the setting `variant.mise.binPath`.

#### Scenario: Untrusted offers Trust

- **WHEN** a commit triggers onboarding detection and Mise reports that `mise.toml` is not trusted
- **THEN** an error notification names the directory and the message with a `Trust` button, and no onboarding notification appears

#### Scenario: Trust then retry

- **WHEN** a person presses `Trust` and the trust command succeeds
- **THEN** `mise -C <dir> trust --all` ran, the confirmation appears, and the failed action runs again

#### Scenario: Not repeated

- **WHEN** the same directory fails the same way on the next commit in the same session
- **THEN** no second notification appears

#### Scenario: Other Mise failure

- **WHEN** Mise fails because of invalid TOML
- **THEN** the notification shows the message and has no `Trust` button

#### Scenario: Trust fails

- **WHEN** the trust command exits with an error
- **THEN** its message is shown and nothing is retried

#### Scenario: Init in the dialog

- **WHEN** a person presses `Init` and Mise reports an untrusted configuration
- **THEN** the dialog stays open with the message and a `Trust` button, and after Trust the `Init` runs again
