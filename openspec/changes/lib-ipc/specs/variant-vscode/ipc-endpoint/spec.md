## Purpose

The extension hosts one Unix domain socket per open workspace folder so other processes in that project can find a listener.

## ADDED Requirements

### Requirement: Activation binds one socket per workspace folder

When the extension activates, it SHALL start a listener at `vscode/variant-worktrees.sock` under each open workspace folder. When no workspace folder is open, it SHALL NOT create a socket.

#### Scenario: One workspace folder

- **WHEN** the extension activates with workspace folder `/work/app`
- **THEN** a listener accepts connections on `/work/app/vscode/variant-worktrees.sock`

#### Scenario: Two workspace folders

- **WHEN** the extension activates with workspace folders `/work/app` and `/work/other`
- **THEN** a listener accepts connections on `/work/app/vscode/variant-worktrees.sock`
- **AND** a listener accepts connections on `/work/other/vscode/variant-worktrees.sock`

#### Scenario: No workspace folder

- **WHEN** the extension activates with no workspace folder
- **THEN** it does not create `vscode/variant-worktrees.sock`

### Requirement: Nested client can ping the workspace socket

A client that starts in a subdirectory of a workspace folder SHALL be able to find that folder's socket by walking parent directories and complete a `ping` while the extension is active.

#### Scenario: Ping from a nested directory

- **WHEN** the extension is active for `/work/app` and a client starts at `/work/app/packages/variant-api`
- **THEN** the client finds `/work/app/vscode/variant-worktrees.sock`
- **AND** a `ping` request returns `result.ok` equal to `true`

### Requirement: Deactivation removes sockets this activation bound

When the extension deactivates, it SHALL remove each socket file bound during that activation. It SHALL leave a socket that this activation failed to bind because another listener already owns it.

#### Scenario: Deactivate unlinks the workspace socket

- **WHEN** the extension activated for `/work/app` and then deactivates
- **THEN** `/work/app/vscode/variant-worktrees.sock` is gone

#### Scenario: Live foreign socket survives deactivation

- **WHEN** another listener already owns `/work/app/vscode/variant-worktrees.sock`, this activation does not take it over, and the extension then deactivates
- **THEN** that socket file remains and still accepts connections
