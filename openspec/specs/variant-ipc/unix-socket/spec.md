# variant-ipc Specification

## Purpose

Unix domain socket for editor requests. Lifecycle commands stay in `variant-api`. Messages that do cross the socket use the same `{name, args}` JSON shape.

## Requirements

### Requirement: Socket path is the resolved .vscode directory plus the file name

The socket path SHALL be the directory from `resolveMainVscodeDir` joined with the file name `variant-worktrees.sock`. This package SHALL NOT choose a different `.vscode` directory.

#### Scenario: Join the file name

- **WHEN** `resolveMainVscodeDir` returns `/work/vw/variant-worktrees/.vscode`
- **THEN** the socket path is `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`

#### Scenario: Single-repo directory

- **WHEN** `resolveMainVscodeDir` returns `/work/.vscode`
- **THEN** the socket path is `/work/.vscode/variant-worktrees.sock`

### Requirement: Listener binds an owner-only socket

Starting a listener on a socket path SHALL create missing parent directories for that path, bind the Unix domain socket, and set the socket so only the owner can read and write it. A directory created for the socket SHALL allow only the owner to access it. An existing directory SHALL keep its current mode.

#### Scenario: First listen creates the socket

- **WHEN** a listener starts for `/work/variant-worktrees/.vscode/variant-worktrees.sock` and `/work/variant-worktrees/.vscode` does not exist
- **THEN** that path exists as a Unix domain socket
- **AND** group and other permission bits on the socket are clear
- **AND** group and other permission bits on `/work/variant-worktrees/.vscode` are clear

#### Scenario: Existing directory keeps its mode

- **WHEN** `/work/.vscode` already exists with mode `0755` and a listener starts for `/work/.vscode/variant-worktrees.sock`
- **THEN** `/work/.vscode` remains mode `0755`
- **AND** the new socket grants access only to the owner

### Requirement: Stale socket is replaced and a live socket is kept

When the socket path exists and no listener accepts connections, a new listener SHALL remove that path and bind. When a listener already accepts connections, a second listener SHALL fail and SHALL leave the existing socket in place.

#### Scenario: Leftover socket file is replaced

- **WHEN** `/work/.vscode/variant-worktrees.sock` exists and no process accepts connections on it
- **THEN** starting a listener removes that file, binds a new socket, and accepts a connection

#### Scenario: Live listener is not replaced

- **WHEN** a listener is already accepting connections on `/work/.vscode/variant-worktrees.sock`
- **THEN** starting a second listener fails
- **AND** the first listener still accepts connections

### Requirement: Request JSON uses the API command object

A connection SHALL exchange UTF-8 JSON values, one value per line, terminated by a newline. A request line SHALL be an object with string `name` and object `args`. A success response line SHALL be the handler's return value, with no added envelope. A failed request SHALL respond with an object `{"error":{"message":"<text>"}}` whose message is non-empty. Requests on one connection SHALL be answered in order. The listener SHALL keep serving other connections when one request fails. This package SHALL NOT call `variant-api`.

#### Scenario: Command object round trip

- **WHEN** a client sends `{"name":"create","args":{"slug":"test-feature"}}` followed by a newline and the handler returns `{"slug":"test-feature"}`
- **THEN** the handler receives `name` `create` and `args` `{"slug":"test-feature"}`
- **AND** the response line is `{"slug":"test-feature"}`
- **AND** `variant-api` does not run

#### Scenario: Handler failure

- **WHEN** a client sends `{"name":"list","args":{}}` followed by a newline and the handler fails
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` does not run

#### Scenario: Invalid line

- **WHEN** a client sends `not-json` followed by a newline
- **THEN** the response line has a non-empty `error.message`
- **AND** the listener still accepts a later request on a new connection

#### Scenario: Two sequential requests

- **WHEN** a client sends two request lines on the same connection
- **THEN** the first response line is the first handler result and the second response line is the second handler result

### Requirement: Connect does not create a socket

A client connect SHALL NOT create the socket file. Connecting to a path that is not a live socket SHALL fail.

#### Scenario: Connect without a listener

- **WHEN** a client connects to `/work/.vscode/variant-worktrees.sock` and no listener is bound there
- **THEN** the connect attempt fails
- **AND** the client does not create that socket file

### Requirement: Stopping the listener removes its socket

Stopping a listener SHALL remove the socket file that listener bound. It SHALL NOT remove a socket that another live listener still owns.

#### Scenario: Stop unlinks the socket

- **WHEN** a listener bound `/work/.vscode/variant-worktrees.sock` and then stops
- **THEN** that socket file is gone

#### Scenario: Failed second listener does not unlink the live socket

- **WHEN** a second listener fails because the first listener is live, and the second listener then stops
- **THEN** the first listener's socket file remains
