## Purpose

Shared Unix domain socket so one process can host a project listener and another can find it by walking up from its working directory.

## ADDED Requirements

### Requirement: Socket path under the project root

The socket path relative to a project root SHALL be `vscode/variant-worktrees.sock`.

#### Scenario: Absolute path for a project root

- **WHEN** the project root is `/work/app`
- **THEN** the socket path is `/work/app/vscode/variant-worktrees.sock`

### Requirement: Discovery walks parent directories

Discovery SHALL start at a given directory and walk through each parent, including the start directory, until it finds `vscode/variant-worktrees.sock` or reaches the filesystem root. The nearest match SHALL win. Discovery SHALL NOT create the socket file.

#### Scenario: Socket found above the start directory

- **WHEN** discovery starts at `/work/app/packages/variant-api` and `/work/app/vscode/variant-worktrees.sock` exists and no nearer match exists
- **THEN** discovery returns `/work/app/vscode/variant-worktrees.sock`

#### Scenario: Nearer socket wins

- **WHEN** discovery starts at `/work/app/packages/variant-api` and both `/work/app/packages/vscode/variant-worktrees.sock` and `/work/app/vscode/variant-worktrees.sock` exist
- **THEN** discovery returns `/work/app/packages/vscode/variant-worktrees.sock`

#### Scenario: Missing socket

- **WHEN** discovery starts at `/work/app` and no `vscode/variant-worktrees.sock` exists at that directory or any parent
- **THEN** discovery fails and reports that `vscode/variant-worktrees.sock` was not found

### Requirement: Listener binds an owner-only socket

Starting a listener for a project root SHALL create `vscode/` when that directory is missing, bind `vscode/variant-worktrees.sock`, and set the socket so only the owner can read and write it. A directory created for the socket SHALL allow only the owner to access it. An existing `vscode/` directory SHALL keep its current mode.

#### Scenario: First listen creates the socket

- **WHEN** a listener starts for `/work/app` and `/work/app/vscode` does not exist
- **THEN** `/work/app/vscode/variant-worktrees.sock` exists as a Unix domain socket
- **AND** group and other permission bits on the socket are clear
- **AND** group and other permission bits on `/work/app/vscode` are clear

#### Scenario: Existing directory keeps its mode

- **WHEN** `/work/app/vscode` already exists with mode `0755` and a listener starts for `/work/app`
- **THEN** `/work/app/vscode` remains mode `0755`
- **AND** the new socket grants access only to the owner

### Requirement: Stale socket is replaced and a live socket is kept

When the socket path exists and no listener accepts connections, a new listener SHALL remove that path and bind. When a listener already accepts connections, a second listener SHALL fail and SHALL leave the existing socket in place.

#### Scenario: Leftover socket file is replaced

- **WHEN** `/work/app/vscode/variant-worktrees.sock` exists and no process accepts connections on it
- **THEN** starting a listener removes that file, binds a new socket, and accepts a connection

#### Scenario: Live listener is not replaced

- **WHEN** a listener is already accepting connections on `/work/app/vscode/variant-worktrees.sock`
- **THEN** starting a second listener fails
- **AND** the first listener still accepts connections

### Requirement: Newline-delimited JSON request and response

A connection SHALL exchange UTF-8 JSON objects, one object per line, terminated by a newline. A request SHALL include string fields `id` and `method` and MAY include `params`. A success response SHALL include the same `id` and a `result` field. An error response SHALL include the same `id` when the request had one, and an `error` object with a string `message`. Requests on one connection SHALL be answered in order. The listener SHALL keep serving other connections when one request fails.

#### Scenario: Ping round trip

- **WHEN** a client sends `{"id":"1","method":"ping"}` followed by a newline
- **THEN** the response line has `id` equal to `"1"` and `result.ok` equal to `true`

#### Scenario: Unknown method

- **WHEN** a client sends `{"id":"2","method":"missing"}` followed by a newline
- **THEN** the response line has `id` equal to `"2"` and a non-empty `error.message`

#### Scenario: Invalid line

- **WHEN** a client sends `not-json` followed by a newline
- **THEN** the response line has a non-empty `error.message`
- **AND** the listener still accepts a later `ping` on a new connection

#### Scenario: Two sequential requests

- **WHEN** a client sends a `ping` with `id` `"a"` and then a `ping` with `id` `"b"` on the same connection
- **THEN** the first response line has `id` `"a"` and the second has `id` `"b"`

### Requirement: Connect does not create a socket

A client connect SHALL NOT create `vscode/variant-worktrees.sock`. Connecting to a path that is not a live socket SHALL fail.

#### Scenario: Connect without a listener

- **WHEN** a client connects to `/work/app/vscode/variant-worktrees.sock` and no listener is bound there
- **THEN** the connect attempt fails
- **AND** the client does not create that socket file

### Requirement: Stopping the listener removes its socket

Stopping a listener SHALL remove the socket file that listener bound. It SHALL NOT remove a socket that another live listener still owns.

#### Scenario: Stop unlinks the socket

- **WHEN** a listener bound `/work/app/vscode/variant-worktrees.sock` and then stops
- **THEN** that socket file is gone

#### Scenario: Failed second listener does not unlink the live socket

- **WHEN** a second listener fails because the first listener is live, and the second listener then stops
- **THEN** the first listener's socket file remains
