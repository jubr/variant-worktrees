## MODIFIED Requirements

### Requirement: Deactivation removes sockets this activation bound

When the extension deactivates, it SHALL remove each socket file bound during that activation, and deactivation SHALL complete even when a client still holds an open connection to that socket. It SHALL leave a socket that this activation failed to bind because another listener already owns it.

#### Scenario: Deactivate unlinks the socket

- **WHEN** the extension activated for `/work/vw/variant-worktrees` and then deactivates
- **THEN** `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock` is gone

#### Scenario: Deactivate with a connected client

- **WHEN** the extension activated for `/work/vw/variant-worktrees`, a client holds a connection open to its socket, and the extension then deactivates
- **THEN** deactivation completes
- **AND** `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock` is gone

#### Scenario: Live foreign socket survives deactivation

- **WHEN** another listener already owns `/work/.vscode/variant-worktrees.sock`, this activation does not take it over, and the extension then deactivates
- **THEN** that socket file remains and still accepts connections
