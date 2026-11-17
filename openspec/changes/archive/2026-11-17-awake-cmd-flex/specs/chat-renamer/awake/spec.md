## MODIFIED Requirements

### Requirement: One caffeinate process while a chat session is active

With `awake.when` equal to `chatsActive`, the owning instance SHALL keep the machine awake while at least one chat turn that this host's turn watcher has started and not ended is in progress, and, apart from the startup probe below, SHALL NOT keep it awake otherwise. The watcher reports a turn start and a turn end, each with a session id and a turn id. A start SHALL mark that turn active. An end SHALL mark that same turn idle. The host SHALL stay active while any such turn is still open, including while that turn is between tool calls and the watcher has not ended it. The host SHALL also poll every 5 seconds. The ids that poll examines SHALL be the first 20 ids in that workspace's last-focused composer list. The pane order of selected chats SHALL NOT supply that list. A composer among those 20 SHALL count as active while it is taking a turn or generating, including tool work whose row is aborted while the turn is still unfinished, even when the watcher has not reported that turn. A composer id outside those 20 SHALL NOT count on the poll. The host SHALL NOT read session files to decide awake. When the watcher cannot be created, the poll SHALL still run. A missing, empty, or unreadable last-focused list SHALL leave that poll sample idle and SHALL NOT throw. A chat that is only open, selected, or idle SHALL NOT count. A turn in a workspace this host does not have open SHALL NOT count, including a turn that is visible only because every host reads one shared composer store. Two hosts that both have the same workspace open MAY each count a focused turn in that workspace. The host SHALL stay active while the watcher has an open turn or the latest poll sample is active. A watcher end while the latest poll sample is still active SHALL NOT start the grace delay. Awake SHALL be one child process per owning host. The command SHALL be `awake.cmd`, split on whitespace into a program and its arguments and run without a shell, with `${extensionHostPid}` replaced by the pid of the extension host that spawned the child. The default command is `/usr/bin/caffeinate -disu -w ${extensionHostPid}`. Any `awake.cmd` SHALL be tried, including one that is not `caffeinate`. The child of the default command SHALL exit when that pid exits, including when the host is killed without running dispose, and SHALL NOT remain running after that host process is gone. A command that does not wait on `${extensionHostPid}` MAY outlive a host that is killed without running dispose. The extension SHALL track that single pid. It SHALL start the process when a session of that host becomes active and no tracked process is running with those arguments. It SHALL NOT start a second process while that one is still running with the same arguments, including when another session of that host becomes active. When the last active session of that host ends, the extension SHALL keep the tracked process until `awake.graceDelaySecs` seconds have passed with no active session of that host, and SHALL then kill it. A session of another host SHALL NOT cancel that delay and SHALL NOT keep the process alive. `0` SHALL kill it at once. A session of that host that becomes active during that delay SHALL keep the same process and cancel the delay. Changing `awake.graceDelaySecs` during the delay SHALL apply the new value measured from when the session went idle, and SHALL kill at once when the new value has already elapsed. When `awake.cmd` changes while a session of that host is active, the extension SHALL kill the tracked process and, once it has exited, SHALL start the new command. When the tracked process exits on its own while a session of that host is still active and the host process is still running, the extension SHALL start one replacement. With `awake.when` equal to `never`, the extension SHALL NOT start a process and SHALL kill a tracked one at once, including during the delay. Disposal of the owner, and loss of ownership, SHALL kill a tracked process at once. An instance that does not own renaming SHALL NOT start a process. A start fails when the program cannot be executed (it is not found, not permitted, or the spawn reports any other error) or when the process exits within 1 second of being started. A failed start SHALL be logged as the logging requirement says, SHALL NOT throw out of the extension, SHALL NOT be replaced at once, and SHALL be tried again the next time a session of that host is active and no process is tracked. A tracked process that exits on its own after more than 1 second keeps the replacement rule above. When the owner starts, it SHALL check once whether `caffeinate` can be run. When it cannot, the extension SHALL NOT start the default command, and SHALL still try any other `awake.cmd`. The first time the owner has `awake.when` equal to `chatsActive`, which is right after that check and does not wait for a session, the extension SHALL try `awake.cmd` once as a startup probe, except that it SHALL NOT probe the default command when `caffeinate` cannot be run. The probe SHALL be the tracked process, so it is the one process of that host. A session of that host that is active during or after the probe SHALL keep that process. When no session of that host is active 1 second after the probe started, the extension SHALL kill it. A probe that fails is a failed start. The probe SHALL run at most once for the life of the owner, and a later `awake.cmd` or `awake.when` change SHALL NOT start another.

#### Scenario: Generation holds the display

- **WHEN** `awake.when` is `chatsActive`, `awake.cmd` is unset, `caffeinate` is detected, and a chat session of this host starts generating
- **THEN** one `caffeinate` process is running with arguments `-disu` and `-w` followed by this host's pid

#### Scenario: Cpu mode

- **WHEN** `awake.cmd` is `caffeinate -dis -w ${extensionHostPid}` and a chat session of this host is taking a turn
- **THEN** one process is running with program `caffeinate` and arguments `-dis`, `-w`, and this host's pid
- **AND** no process is running with `-disu`

#### Scenario: Command that is not caffeinate

- **WHEN** `awake.cmd` is `/usr/local/bin/keep-awake --pid ${extensionHostPid}`, that program can be executed, and a chat session of this host is taking a turn
- **THEN** one process is running for that program with arguments `--pid` and this host's pid

#### Scenario: Command cannot be executed

- **WHEN** `awake.cmd` is `/nonexistent/keep-awake` and a chat session of this host is taking a turn
- **THEN** the extension keeps running and no process is tracked
- **AND** the log has one warn line for that command
- **AND** a later observation of that activity tries it again without a second warn line

#### Scenario: Command exits at once

- **WHEN** `awake.cmd` runs a program that exits within 1 second of starting, and a chat session of this host stays active across several observations
- **THEN** that start counts as failed and is not replaced at once
- **AND** the log has one warn line for that command

#### Scenario: Idle chat does not count

- **WHEN** a chat is open and selected and no session of this host is taking a turn or generating
- **THEN** no `caffeinate` process is running for this host

#### Scenario: Turn start holds the machine before the next poll

- **WHEN** `awake.when` is `chatsActive` and this host's turn watcher reports a turn start
- **THEN** one `caffeinate` process is running for this host
- **AND** that does not wait for the next 5-second poll

#### Scenario: Turn end while the focused row is still unfinished

- **WHEN** the watcher reports that the only open turn has ended and the latest poll still sees that composer among the first 20 last-focused ids with the turn unfinished
- **THEN** the `caffeinate` process is still running
- **AND** the grace delay has not started

#### Scenario: No watcher still polls the focused composers

- **WHEN** `awake.when` is `chatsActive`, this host cannot create a turn watcher, and a composer among the first 20 last-focused ids is in a turn
- **THEN** one `caffeinate` process is running for this host

#### Scenario: Focused turn outside the pane window

- **WHEN** the only active turn is a composer among the first 20 last-focused ids, that composer is outside the first 20 selected chats in pane order, and the watcher has not reported it
- **THEN** one `caffeinate` process is running for this host

#### Scenario: Selected chat outside the focus window

- **WHEN** a selected chat is generating, its composer id is not among the first 20 last-focused ids, and the watcher has not reported it
- **THEN** no `caffeinate` process is running for this host

#### Scenario: Poll interval

- **WHEN** `awake.when` is `chatsActive` and the focused composers stay idle
- **THEN** the host reads those composers again 5 seconds after the previous read
- **AND** it does not read them every second

#### Scenario: Tool work stays inside the turn

- **WHEN** a turn of this host has started, the watcher has not ended it, and the turn is between tool calls and is not generating tokens
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

- **WHEN** `awake.cmd` changes from `/usr/bin/caffeinate -disu -w ${extensionHostPid}` to `caffeinate -dis -w ${extensionHostPid}` while a session of this host is generating
- **THEN** the process started with `-disu` is no longer running
- **AND** once it has exited, one process started with `-dis` is running

#### Scenario: Changed command warns for itself

- **WHEN** `awake.cmd` cannot be executed and has been warned about, then changes to a different command that also cannot be executed while a session is active
- **THEN** the log has one more warn line, for the new command

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

- **WHEN** starting the command fails and a session of this host is still active
- **THEN** the extension keeps running, and a later observation of that activity starts one process

#### Scenario: No caffeinate binary

- **WHEN** the owner starts and the system cannot run `caffeinate`, and a chat session of this host later generates with the default `awake.cmd`
- **THEN** no process is started

#### Scenario: No caffeinate binary, custom command

- **WHEN** the owner starts and the system cannot run `caffeinate`, `awake.cmd` is a different command that can be executed, and a chat session of this host later generates
- **THEN** one process is running for that command

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

- **WHEN** two hosts both have the same workspace open and a composer among that workspace's first 20 last-focused ids is in a turn
- **THEN** each of those hosts is running one `caffeinate` process

#### Scenario: Parent process exits

- **WHEN** the extension host process that started `caffeinate` exits without disposing the owner
- **THEN** that `caffeinate` process is no longer running

### Requirement: Awake activity is logged

Every log line about awake SHALL start with `[awake]`. Starting the process SHALL log, at debug, `+ "/usr/bin/caffeinate -disu -w <host-pid>"`, the child pid, and the reason `activity`, or `probe` for the startup probe. A custom `awake.cmd` SHALL log the same line with that command's program and arguments, `${extensionHostPid}` replaced. Killing it SHALL log, at debug, `+ "kill <pid>"` and a reason of `idle`, `never`, `disposed`, `not owner`, `mode changed`, or `probe`, and SHALL NOT repeat the command. An exit of the tracked process while a session is still active SHALL be logged at warn before the replacement is started. A failed start SHALL be logged at warn, naming the command and the reason, once for each distinct command for as long as the owner lives. A repeat failure of a command that has already been warned about SHALL NOT be logged at warn or above. Starting the idle delay, cancelling it, and the delay elapsing SHALL be logged at trace and SHALL NOT be logged at info or above. When the owner starts, whether `caffeinate` can be run SHALL be logged once at info and SHALL NOT be logged again when a session later generates. When the binary can be run and the turn watcher was created, that info line SHALL be `[awake] caffeinate available method="agentHost+poll"`. When the binary can be run and the watcher was not created, that info line SHALL be `[awake] caffeinate available method="poll"`. When the binary cannot be run, that info line SHALL be `[awake] caffeinate unavailable` and SHALL NOT name a method. Start and kill lines SHALL NOT be logged at info or above.

#### Scenario: Start

- **WHEN** a chat session of this host starts generating, the host pid is `5151`, and `caffeinate` starts as pid `4242` with `-disu`
- **THEN** the log has a debug line `[awake] + "/usr/bin/caffeinate -disu -w 5151" pid=4242 reason="activity"`
- **AND** that line is not at trace

#### Scenario: Idle stop

- **WHEN** the idle delay elapses and pid `4242` is killed
- **THEN** the log has a debug line `[awake] + "kill 4242" reason="idle"`
- **AND** that line is not at trace

#### Scenario: Delay is trace

- **WHEN** the only active session finishes and `awake.graceDelaySecs` is 60
- **THEN** the log has a trace line `[awake]` that names the delay 60
- **AND** it has no info line for that delay

#### Scenario: Probe failure follows the availability line

- **WHEN** the owner starts with `awake.when` `chatsActive` and `awake.cmd` `/nonexistent/keep-awake`, and no session is active
- **THEN** the log has the info line `[awake] caffeinate available method="poll"` or `method="agentHost+poll"`
- **AND** the next `[awake]` line after it is the warn line for `/nonexistent/keep-awake`
- **AND** a session that later generates tries that command again without a second warn line

#### Scenario: Probe is stopped when idle

- **WHEN** the owner starts with a command that can be executed and stays running, and no session of this host is active 1 second later
- **THEN** the log has a debug line `[awake] + "<command>"` with reason `probe`
- **AND** a debug line `[awake] + "kill <pid>"` with reason `probe`
- **AND** no process is running for this host afterwards

#### Scenario: Session adopts the probe

- **WHEN** the owner starts, the probe is running, and a session of this host becomes active within 1 second
- **THEN** that process keeps running and no second process is started

#### Scenario: Probe runs once

- **WHEN** the probe has finished and `awake.cmd` changes while no session is active
- **THEN** no process is started

#### Scenario: No probe for the default command without caffeinate

- **WHEN** the owner starts, `caffeinate` cannot be run, and `awake.cmd` is the default
- **THEN** no process is started and the log has the info line `[awake] caffeinate unavailable` only

#### Scenario: No probe when never

- **WHEN** the owner starts with `awake.when` `never`
- **THEN** no process is started

#### Scenario: Failed start warns once

- **WHEN** `awake.cmd` is `/nonexistent/keep-awake` and a session stays active across several observations
- **THEN** the log has exactly one warn line `[awake]` naming `/nonexistent/keep-awake` and the failure
- **AND** no later failed start of that command is logged at warn or above

#### Scenario: Process exits early

- **WHEN** the tracked process exits while a session is still generating
- **THEN** the log has a warn line `[awake]` for that exit before the replacement start line

#### Scenario: Binary check once at startup

- **WHEN** the owner starts and `caffeinate` cannot be run, then two sessions generate
- **THEN** the log has one info line `[awake] caffeinate unavailable`
- **AND** that line is written at startup, before either session generates
- **AND** that line does not name a method

#### Scenario: Binary present once at startup

- **WHEN** the owner starts, `caffeinate` can be run, and the turn watcher is created, then a session generates
- **THEN** the log has one info line `[awake] caffeinate available method="agentHost+poll"`
- **AND** the generating session does not add a second binary line

#### Scenario: Binary present without a watcher

- **WHEN** the owner starts, `caffeinate` can be run, and the turn watcher is not created
- **THEN** the log has one info line `[awake] caffeinate available method="poll"`
