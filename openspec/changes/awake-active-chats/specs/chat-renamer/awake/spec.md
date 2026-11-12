## MODIFIED Requirements

### Requirement: One caffeinate process while a chat session is active

With `awake.when` equal to `chatsActive`, the owning instance SHALL keep the machine awake while at least one chat session that belongs to that host is active, and SHALL NOT keep it awake otherwise. The composer ids a host examines SHALL be the first 20 ids in that workspace's last-focused composer list. The pane order of selected chats SHALL NOT supply that list. A composer id outside those 20 SHALL NOT belong to the host unless a session file under a workspace folder open in that host is fresh. A session in a workspace this host does not have open SHALL NOT count, including a session that is visible only because every host reads one shared composer store. Two hosts that both have the same workspace open MAY each count a session in that workspace. A session SHALL count as active while it is taking a turn or generating output, including tool work that belongs to that turn, and including tool work whose composer row is aborted while the turn is still unfinished. A session that is only open, selected, or idle SHALL NOT count. When one of those 20 composers is active, the host SHALL have an active session even if no session file under its open workspace folders is fresh. When none of those 20 is active, a fresh session file under a workspace folder open in this host SHALL be an active session of this host. A missing, empty, or unreadable last-focused list SHALL leave the composer signal idle. Awake SHALL be one child process named `caffeinate` per owning host. `awake.what` `screen` SHALL pass the arguments `-disu` and `-w` followed by the pid of the extension host that spawned the child. `awake.what` `cpu` SHALL pass the arguments `-dis` and `-w` followed by that same pid. The child SHALL exit when that pid exits, including when the host is killed without running dispose, and SHALL NOT remain running after that host process is gone. The extension SHALL track that single pid. It SHALL start the process when a session of that host becomes active and no tracked process is running with those arguments. It SHALL NOT start a second process while that one is still running with the same arguments, including when another session of that host becomes active. When the last active session of that host ends, the extension SHALL keep the tracked process until `awake.graceDelaySecs` seconds have passed with no active session of that host, and SHALL then kill it. A session of another host SHALL NOT cancel that delay and SHALL NOT keep the process alive. `0` SHALL kill it at once. A session of that host that becomes active during that delay SHALL keep the same process and cancel the delay. Changing `awake.graceDelaySecs` during the delay SHALL apply the new value measured from when the session went idle, and SHALL kill at once when the new value has already elapsed. When `awake.what` changes while a session of that host is active, the extension SHALL kill the tracked process and start one with the new arguments without waiting. When the tracked process exits on its own while a session of that host is still active and the host process is still running, the extension SHALL start one replacement. With `awake.when` equal to `never`, the extension SHALL NOT start a process and SHALL kill a tracked one at once, including during the delay. Disposal of the owner, and loss of ownership, SHALL kill a tracked process at once. An instance that does not own renaming SHALL NOT start a process. A failed start SHALL be logged, SHALL NOT throw out of the extension, and SHALL be tried again the next time a session of that host is active and no process is tracked. When the owner starts, it SHALL check once whether `caffeinate` can be run. When it cannot, the extension SHALL NOT start a process.

#### Scenario: Generation holds the display

- **WHEN** `awake.when` is `chatsActive`, `awake.what` is `screen`, and a chat session of this host starts generating
- **THEN** one `caffeinate` process is running with arguments `-disu` and `-w` followed by this host's pid

#### Scenario: Cpu mode

- **WHEN** `awake.what` is `cpu` and a chat session of this host is taking a turn
- **THEN** one `caffeinate` process is running with arguments `-dis` and `-w` followed by this host's pid

#### Scenario: Idle chat does not count

- **WHEN** a chat is open and selected and no session of this host is taking a turn or generating
- **THEN** no `caffeinate` process is running for this host

#### Scenario: Focused turn outside the pane window

- **WHEN** `awake.when` is `chatsActive` and the only active turn is a composer among the first 20 last-focused ids, that composer is outside the first 20 selected chats in pane order, and no session file under this host's workspace is fresh
- **THEN** one `caffeinate` process is running for this host

#### Scenario: Unfinished tool work on an aborted row

- **WHEN** a composer among the first 20 last-focused ids is aborted, is not generating tokens, and the turn is still unfinished
- **THEN** one `caffeinate` process is running for this host

#### Scenario: Selected chat outside the focus window

- **WHEN** a selected chat is generating, its composer id is not among the first 20 last-focused ids, and no session file under this host's workspace is fresh
- **THEN** no `caffeinate` process is running for this host

#### Scenario: Fresh session file while focused chats are idle

- **WHEN** none of the first 20 last-focused composers is taking a turn or generating, and a session file under a workspace folder open in this host is fresh
- **THEN** one `caffeinate` process is running for this host

#### Scenario: Tool work stays inside the turn

- **WHEN** a chat session of this host is between tool calls of the same turn and is not generating tokens
- **THEN** the `caffeinate` process started for that turn is still running

#### Scenario: Two sessions, one process

- **WHEN** one chat session of this host is generating and a second session of this host starts a turn
- **THEN** still one `caffeinate` process is running for this host

#### Scenario: Last session ends after the delay

- **WHEN** the only active session of this host finishes its turn and `awake.graceDelaySecs` is 60
- **THEN** that `caffeinate` process is still running
- **AND** 60 seconds later, with no active session of this host, it is no longer running

#### Scenario: Activity during the delay

- **WHEN** a session of this host becomes active again before `awake.graceDelaySecs` elapses
- **THEN** the same `caffeinate` process is still running after the delay would have elapsed

#### Scenario: Another host does not cancel the delay

- **WHEN** this host's last session has gone idle and the grace delay is running, and another host has a session generating
- **THEN** the delay still elapses
- **AND** this host's `caffeinate` process is no longer running after the delay

#### Scenario: No delay

- **WHEN** `awake.graceDelaySecs` is 0 and the only active session of this host finishes its turn
- **THEN** that `caffeinate` process is no longer running

#### Scenario: One of two sessions ends

- **WHEN** two sessions of this host are active and one finishes
- **THEN** the same `caffeinate` process is still running

#### Scenario: Mode change replaces the process

- **WHEN** `awake.what` changes from `screen` to `cpu` while a session of this host is generating
- **THEN** the process started with `-disu` is no longer running and one process started with `-dis` and `-w` followed by this host's pid is running

#### Scenario: Unexpected exit

- **WHEN** the tracked `caffeinate` process exits while a session of this host is still generating and the host process is still running
- **THEN** one new `caffeinate` process is running with the same arguments

#### Scenario: Never

- **WHEN** `awake.when` is `never` and a chat session of this host is generating
- **THEN** no `caffeinate` process is running for this host

#### Scenario: Owner only

- **WHEN** Variant owns renaming and Chat Renamer does not, and a chat session of this host is generating
- **THEN** only the owning instance has started `caffeinate`

#### Scenario: Owner disposed

- **WHEN** the owning instance is disposed while `caffeinate` is running
- **THEN** that process is no longer running

#### Scenario: Start failure

- **WHEN** starting `caffeinate` fails and a session of this host is still active
- **THEN** the extension keeps running, and a later observation of that activity starts one process

#### Scenario: No caffeinate binary

- **WHEN** the owner starts and the system cannot run `caffeinate`, and a chat session of this host later generates
- **THEN** no process is started

#### Scenario: Another host's session does not count

- **WHEN** a chat session is generating in a workspace this host does not have open, and this host has no session taking a turn or generating
- **THEN** this host is not running `caffeinate`

#### Scenario: This host's session does not wake another host

- **WHEN** this host has a session generating and another host has no session of its own taking a turn or generating
- **THEN** this host is running one `caffeinate` process
- **AND** the other host is not running `caffeinate`

#### Scenario: Two hosts, two processes

- **WHEN** two hosts each have their own session generating
- **THEN** each host is running one `caffeinate` process

#### Scenario: Same workspace, both hosts

- **WHEN** two hosts both have the same workspace open and a session in that workspace is generating
- **THEN** each of those hosts is running one `caffeinate` process

#### Scenario: Parent process exits

- **WHEN** the extension host process that started `caffeinate` exits without disposing the owner
- **THEN** that `caffeinate` process is no longer running

#### Scenario: Missing focus list

- **WHEN** the last-focused list cannot be read, no session file under this host's workspace is fresh, and a chat in another workspace is generating
- **THEN** this host is not running `caffeinate`
