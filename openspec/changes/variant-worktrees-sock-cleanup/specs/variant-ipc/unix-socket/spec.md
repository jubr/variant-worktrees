## MODIFIED Requirements

### Requirement: Stopping the listener removes its socket

Stopping a listener SHALL remove the socket file that listener bound, and SHALL complete even when clients still hold open connections: those connections SHALL be closed and SHALL NOT delay or prevent the removal. It SHALL NOT remove a socket that another live listener still owns, and it SHALL NOT remove a file at that path that a different listener bound after this listener did.

#### Scenario: Stop unlinks the socket

- **WHEN** a listener bound `/work/.vscode/variant-worktrees.sock` and then stops
- **THEN** that socket file is gone

#### Scenario: Open client connection does not block removal

- **WHEN** a client holds a connection open to a listener bound at `/work/.vscode/variant-worktrees.sock` and the listener stops
- **THEN** the stop completes
- **AND** that socket file is gone
- **AND** the client's connection is closed

#### Scenario: Failed second listener does not unlink the live socket

- **WHEN** a second listener fails because the first listener is live, and the second listener then stops
- **THEN** the first listener's socket file remains

#### Scenario: Replaced socket file is left alone

- **WHEN** the file at `/work/.vscode/variant-worktrees.sock` is removed while its listener runs, a second listener binds the same path, and the first listener then stops
- **THEN** the second listener's socket file remains and accepts connections

## ADDED Requirements

### Requirement: Process exit removes the socket

A listener that is bound SHALL remove its socket file when its process exits without the listener having been stopped. The removal SHALL be synchronous, so it completes during process exit. A listener that has stopped SHALL NOT remove anything at process exit. A process that is killed without running exit handlers leaves its file; the next listener on that path SHALL replace it as a stale socket.

#### Scenario: Exit without stop unlinks the socket

- **WHEN** a process binds a listener on `/work/.vscode/variant-worktrees.sock` and exits without stopping it
- **THEN** that socket file is gone

#### Scenario: Exit after stop leaves a successor alone

- **WHEN** a listener stops, another listener binds the same path, and the first process then exits
- **THEN** the second listener's socket file remains and accepts connections

#### Scenario: Killed process leaves a replaceable file

- **WHEN** a process holding a listener on `/work/.vscode/variant-worktrees.sock` is killed with SIGKILL
- **THEN** the socket file may remain
- **AND** a new listener started on that path replaces it and accepts connections
