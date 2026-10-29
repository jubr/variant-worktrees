# variant-vscode Specification

## Purpose

The extension hosts the project Unix socket for requests that need the editor. Lifecycle commands stay in `variant-api`.

## Requirements

### Requirement: Activation binds the resolved socket

When the extension activates, it SHALL listen on `{resolveMainVscodeDir}/variant-worktrees.sock` for the workspace folder. Distinct socket paths SHALL each get a listener. Repeated resolutions of one path SHALL share one listener. When no workspace folder is open, it SHALL NOT create a socket.

#### Scenario: Worktree workspace in a symlink container

- **WHEN** the extension activates with workspace folder `/work/vw/_v-lib-ipc` in the linked checkout layout
- **THEN** a listener accepts connections on `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`
- **AND** `/work/vw/_v-lib-ipc/.vscode/variant-worktrees.sock` is absent

#### Scenario: Main checkout workspace

- **WHEN** the extension activates with workspace folder `/work/vw/variant-worktrees` in the linked checkout layout
- **THEN** a listener accepts connections on `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`

#### Scenario: Single-repo workspace

- **WHEN** the extension activates with workspace folder `/work/_v-lib-ipc` in the single-repo layout
- **THEN** a listener accepts connections on `/work/.vscode/variant-worktrees.sock`

#### Scenario: Two folders, one socket path

- **WHEN** the extension activates with workspace folders `/work/vw` and `/work/vw/variant-worktrees` and both resolve to `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`
- **THEN** one listener accepts connections on that path

#### Scenario: No workspace folder

- **WHEN** the extension activates with no workspace folder
- **THEN** it does not create `.vscode/variant-worktrees.sock`

### Requirement: Lifecycle commands are not handled here

The extension SHALL NOT execute `config`, `create`, `list`, `provision`, `up`, `down`, `watch`, or `implode`. A socket request with one of those names SHALL fail and SHALL NOT call `variant-api`.

#### Scenario: Create is refused

- **WHEN** a client sends `{"name":"create","args":{"slug":"test-feature"}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` create does not run

#### Scenario: List is refused

- **WHEN** a client sends `{"name":"list","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` list does not run

#### Scenario: Implode is refused

- **WHEN** a client sends `{"name":"implode","args":{"slug":"test-feature"}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` implode does not run

#### Scenario: Watch is refused

- **WHEN** a client sends `{"name":"watch","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` watch does not run

### Requirement: Deactivation removes sockets this activation bound

When the extension deactivates, it SHALL remove each socket file bound during that activation. It SHALL leave a socket that this activation failed to bind because another listener already owns it.

#### Scenario: Deactivate unlinks the socket

- **WHEN** the extension activated for `/work/vw/variant-worktrees` and then deactivates
- **THEN** `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock` is gone

#### Scenario: Live foreign socket survives deactivation

- **WHEN** another listener already owns `/work/.vscode/variant-worktrees.sock`, this activation does not take it over, and the extension then deactivates
- **THEN** that socket file remains and still accepts connections
