## MODIFIED Requirements

### Requirement: One caffeinate process while a chat session is active

With `awake.when` equal to `chatsActive`, the owning instance SHALL keep the machine awake while at least one chat turn that this host's turn watcher has started and not ended is in progress, and SHALL NOT keep it awake otherwise. The watcher reports a turn start and a turn end, each with a session id and a turn id. A start SHALL mark that turn active. An end SHALL mark that same turn idle. The host SHALL stay active while any such turn is still open, including while that turn is between tool calls and the watcher has not ended it. The host SHALL also poll every 5 seconds. The ids that poll examines SHALL be the first 20 ids in that workspace's last-focused composer list. The pane order of selected chats SHALL NOT supply that list. A composer among those 20 SHALL count as active while it is taking a turn or generating, including tool work whose row is aborted while the turn is still unfinished, even when the watcher has not reported that turn. A composer id outside those 20 SHALL NOT count on the poll. The host SHALL NOT read session files to decide awake. When the watcher cannot be created, the poll SHALL still run. A missing, empty, or unreadable last-focused list SHALL leave that poll sample idle and SHALL NOT throw. A chat that is only open, selected, or idle SHALL NOT count. A turn in a workspace this host does not have open SHALL NOT count, including a turn that is visible only because every host reads one shared composer store. Two hosts that both have the same workspace open MAY each count a focused turn in that workspace. The host SHALL stay active while the watcher has an open turn or the latest poll sample is active. A watcher end while the latest poll sample is still active SHALL NOT start the grace delay. Awake SHALL be one child process per owning host. The only command SHALL be `caffeinate -disu -w ${extensionHostPid}`. `${extensionHostPid}` SHALL be replaced with the pid of the extension host that spawned the child. Any other `awake.cmd` SHALL NOT start a process. The child SHALL exit when that pid exits, including when the host is killed without running dispose, and SHALL NOT remain running after that host process is gone. The extension SHALL track that single pid. It SHALL start the process when a session of that host becomes active and no tracked process is running with those arguments. It SHALL NOT start a second process while that one is still running with the same arguments, including when another session of that host becomes active. When the last active session of that host ends, the extension SHALL keep the tracked process until `awake.graceDelaySecs` seconds have passed with no active session of that host, and SHALL then kill it. A session of another host SHALL NOT cancel that delay and SHALL NOT keep the process alive. `0` SHALL kill it at once. A session of that host that becomes active during that delay SHALL keep the same process and cancel the delay. Changing `awake.graceDelaySecs` during the delay SHALL apply the new value measured from when the session went idle, and SHALL kill at once when the new value has already elapsed. When `awake.cmd` changes to anything other than `caffeinate -disu -w ${extensionHostPid}` while a session of that host is active, the extension SHALL kill the tracked process and SHALL NOT start a different command. When the tracked process exits on its own while a session of that host is still active and the host process is still running, the extension SHALL start one replacement. With `awake.when` equal to `never`, the extension SHALL NOT start a process and SHALL kill a tracked one at once, including during the delay. Disposal of the owner, and loss of ownership, SHALL kill a tracked process at once. An instance that does not own renaming SHALL NOT start a process. A failed start SHALL be logged, SHALL NOT throw out of the extension, and SHALL be tried again the next time a session of that host is active and no process is tracked. When the owner starts, it SHALL check once whether `caffeinate` can be run. When it cannot, the extension SHALL NOT start a process.

#### Scenario: Generation holds the display

- **WHEN** `awake.when` is `chatsActive`, `awake.cmd` is unset, `caffeinate` is detected, and a chat session of this host starts generating
- **THEN** one `caffeinate` process is running with arguments `-disu` and `-w` followed by this host's pid

#### Scenario: Cpu mode

- **WHEN** `awake.cmd` is `caffeinate -dis -w ${extensionHostPid}` and a chat session of this host is taking a turn
- **THEN** no `caffeinate` process is running
- **AND** the only command that runs for an active session is `caffeinate -disu -w` followed by this host's pid

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

- **WHEN** `awake.cmd` changes from `caffeinate -disu -w ${extensionHostPid}` to `caffeinate -dis -w ${extensionHostPid}` while a session of this host is generating
- **THEN** the process started with `-disu` is no longer running
- **AND** no process started with `-dis` is running

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

- **WHEN** two hosts both have the same workspace open and a composer among that workspace's first 20 last-focused ids is in a turn
- **THEN** each of those hosts is running one `caffeinate` process

#### Scenario: Parent process exits

- **WHEN** the extension host process that started `caffeinate` exits without disposing the owner
- **THEN** that `caffeinate` process is no longer running

### Requirement: Awake activity is logged

Every log line about awake SHALL start with `[awake]`. Starting the process SHALL log, at debug, `+ "caffeinate -disu -w <host-pid>"`, the child pid, and the reason `activity`. Killing it SHALL log, at debug, `+ "kill <pid>"` and a reason of `idle`, `never`, `disposed`, `not owner`, or `mode changed`, and SHALL NOT repeat the `caffeinate` command. An exit of the tracked process while a session is still active SHALL be logged at warn before the replacement is started. A failed start SHALL be logged at error. Starting the idle delay, cancelling it, and the delay elapsing SHALL be logged at trace and SHALL NOT be logged at info or above. When the owner starts, whether `caffeinate` can be run SHALL be logged once at info and SHALL NOT be logged again when a session later generates. When the binary can be run and the turn watcher was created, that info line SHALL be `[awake] caffeinate available method="agentHost+poll"`. When the binary can be run and the watcher was not created, that info line SHALL be `[awake] caffeinate available method="poll"`. When the binary cannot be run, that info line SHALL be `[awake] caffeinate unavailable` and SHALL NOT name a method. Start and kill lines SHALL NOT be logged at info or above.

#### Scenario: Start

- **WHEN** a chat session of this host starts generating, the host pid is `5151`, and `caffeinate` starts as pid `4242` with `-disu`
- **THEN** the log has a debug line `[awake] + "caffeinate -disu -w 5151" pid=4242 reason="activity"`
- **AND** that line is not at trace

#### Scenario: Idle stop

- **WHEN** the idle delay elapses and pid `4242` is killed
- **THEN** the log has a debug line `[awake] + "kill 4242" reason="idle"`
- **AND** that line is not at trace

#### Scenario: Delay is trace

- **WHEN** the only active session finishes and `awake.graceDelaySecs` is 60
- **THEN** the log has a trace line `[awake]` that names the delay 60
- **AND** it has no info line for that delay

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

### Requirement: Awake settings

The renamer SHALL read `awake.when`, `awake.cmd`, and `awake.graceDelaySecs` from its settings section. `awake.when` SHALL be `chatsActive` or `never`, default `chatsActive`. `awake.cmd` SHALL be a non-empty string. When it is unset, blank, or not a string, the renamer SHALL use `caffeinate -disu -w ${extensionHostPid}`, the command detected for `caffeinate`. `${extensionHostPid}` SHALL be replaced with the pid of the extension host when the command is started. `awake.graceDelaySecs` SHALL be an integer of at least 0, default 60. A `when` or `graceDelaySecs` outside those sets SHALL be treated as the default. `awake.what` SHALL NOT be a setting. Standalone keys SHALL be `chat-renamer.awake.when`, `chat-renamer.awake.cmd`, and `chat-renamer.awake.graceDelaySecs`. When embedded in Variant the keys SHALL be `variant.awake.when`, `variant.awake.cmd`, and `variant.awake.graceDelaySecs`. A host MAY supply the same options from `variants.yaml` under `chatRenamer.awake.when`, `chatRenamer.awake.cmd`, and `chatRenamer.awake.graceDelaySecs`. A value the user set in the editor SHALL win over the host-supplied value, which SHALL win over the default. Changing any of these settings SHALL apply without a reload. `enable` SHALL NOT change whether awake runs: with `variant.enable` false and `awake.when` left at `chatsActive`, an active chat session SHALL still be held awake. The standalone manifest and the Variant manifest SHALL contribute all three settings with the same types, minimum, and defaults.

#### Scenario: Defaults

- **WHEN** neither setting is set and `caffeinate` is detected
- **THEN** `awake.when` is `chatsActive`, `awake.cmd` is `caffeinate -disu -w ${extensionHostPid}`, and `awake.graceDelaySecs` is 60

#### Scenario: Unknown values

- **WHEN** `awake.when` is `always`, `awake.cmd` is blank, and `awake.graceDelaySecs` is `-1`
- **THEN** the renamer uses `chatsActive`, `caffeinate -disu -w ${extensionHostPid}`, and 60

#### Scenario: Editor wins over the file

- **WHEN** `variants.yaml` sets `chatRenamer.awake.when` to `never` and the user set `chatsActive` in the editor
- **THEN** the renamer uses `chatsActive`

#### Scenario: File wins over the default

- **WHEN** the user set nothing in the editor and `variants.yaml` sets `chatRenamer.awake.cmd` to `caffeinate -disu -w ${extensionHostPid}`
- **THEN** the renamer uses that command

#### Scenario: Variant enable stays out of it

- **WHEN** `variant.enable` is false, `awake.when` is `chatsActive`, and a chat session is generating
- **THEN** the machine is held awake

#### Scenario: Manifest copy

- **WHEN** the standalone manifest contributes `chat-renamer.awake.when`, `chat-renamer.awake.cmd`, and `chat-renamer.awake.graceDelaySecs`
- **THEN** the Variant manifest contributes `variant.awake.when`, `variant.awake.cmd`, and `variant.awake.graceDelaySecs` with the same types, minimum, and defaults

#### Scenario: Setting change applies without a reload

- **WHEN** `awake.when` changes from `chatsActive` to `never` while a chat session is generating
- **THEN** the machine is no longer held awake, without a reload

## ADDED Requirements

### Requirement: Turn watcher events are traced

While the owner holds a turn watcher, each turn start and each turn end SHALL be logged at trace, prefixed with `[awake]`, and SHALL include the session id, the turn id, and whether the turn started or ended, only when `awake.agentHostEvents` is enabled. When that category is not enabled, those lines SHALL NOT be written at any level. Creating the watcher and a failed create SHALL NOT be this category: the detection method on the startup info line is the record of which path is in use. These event lines SHALL NOT be logged at info or above. A start or end SHALL NOT by itself log a `caffeinate` command; the process log stays on the existing debug lines.

#### Scenario: Start and end at trace when the category is enabled

- **WHEN** `awake.agentHostEvents` is enabled and the watcher reports a turn start for session `sess-1` turn `turn-1`, then the matching end
- **THEN** the log has a trace line `[awake]` naming `sess-1`, `turn-1`, and start
- **AND** a trace line `[awake]` naming `sess-1`, `turn-1`, and end
- **AND** neither line is at info

#### Scenario: Category off writes nothing

- **WHEN** `awake.agentHostEvents` is not enabled and the watcher reports a turn start and the matching end
- **THEN** the log has no line for that start or end at any level
