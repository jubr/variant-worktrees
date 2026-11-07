## ADDED Requirements

### Requirement: Mise install flag

The commands `create`, `provision`, and `watch` SHALL accept an optional string `miseInstall` whose only values are `bg`, `sync`, and `no`. No other command SHALL take `miseInstall`. The CLI, the MCP server, and the webview forms SHALL derive the flag, tool input, and field from that definition. The CLI flag SHALL be `--mise-install` and SHALL have no short flag. When the flag is omitted, the parsed arguments SHALL NOT include `miseInstall`, and the command SHALL run as `bg` as the core capability specifies. A value other than `bg`, `sync`, or `no` SHALL be rejected and SHALL NOT create a worktree.

#### Scenario: Sync value

- **WHEN** a user runs `variant create --mise-install=sync --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", miseInstall: "sync" }`

#### Scenario: Spaced value

- **WHEN** a user runs `variant create --mise-install bg --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", miseInstall: "bg" }`

#### Scenario: Provision and watch take the flag

- **WHEN** a user runs `variant provision --mise-install=no --slug demo` or `variant watch --mise-install=sync --slug demo`
- **THEN** `execute()` receives `miseInstall` of `no` or `sync` for that command

#### Scenario: Omitted flag runs in the background

- **WHEN** a user runs `variant create --slug demo` in a worktree that contains `mise.toml` and `install` sleeps
- **THEN** the parsed arguments do not include `miseInstall`
- **AND** the command returns while `install` is still running

#### Scenario: No skips install

- **WHEN** a user runs `variant create --mise-install=no --slug demo` in a worktree that contains `mise.toml`
- **THEN** `execute()` receives `{ slug: "demo", miseInstall: "no" }`
- **AND** Mise does not run

#### Scenario: Help lists the flag

- **WHEN** a user runs `variant create --help`, `variant provision --help`, or `variant watch --help`
- **THEN** the help text lists `--mise-install`
- **AND** the help text names `bg`, `sync`, and `no`
- **AND** the help text says that omitting the flag installs in the background
- **AND** the help text lists no short flag for it

#### Scenario: Invalid value

- **WHEN** a user runs `variant create --mise-install=later --slug demo` and no worktree for `demo` exists
- **THEN** the CLI rejects the value
- **AND** no worktree for `demo` exists

#### Scenario: Other commands reject the flag

- **WHEN** a user runs `variant up --mise-install=no`, `variant down --mise-install=no`, `variant implode --mise-install=no`, or `variant config --mise-install=no`
- **THEN** the CLI rejects the unknown flag

#### Scenario: The CLI exits before a background install finishes

- **WHEN** a user runs `variant create --slug demo` in a worktree that contains `mise.toml` and `install` writes a marker when it exits
- **THEN** the process exits 0 before that marker exists
- **AND** the marker is written afterwards
