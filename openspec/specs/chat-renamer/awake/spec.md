# chat-renamer Specification

## Purpose

Holds the Mac awake with one `caffeinate` process while a Cursor chat session is taking a turn or generating, and stops that process when the sessions go idle.

## Requirements

### Requirement: Awake settings

The renamer SHALL read `awake.when`, `awake.what`, and `awake.graceDelaySecs` from its settings section. `awake.when` SHALL be `chatsActive` or `never`, default `chatsActive`. `awake.what` SHALL be `screen` or `cpu`, default `screen`. `awake.graceDelaySecs` SHALL be an integer of at least 0, default 60. A value outside those sets SHALL be treated as the default. Standalone keys SHALL be `chat-renamer.awake.when`, `chat-renamer.awake.what`, and `chat-renamer.awake.graceDelaySecs`. When embedded in Variant the keys SHALL be `variant.awake.when`, `variant.awake.what`, and `variant.awake.graceDelaySecs`. A host MAY supply the same options from `variants.yaml` under `chatRenamer.awake.when`, `chatRenamer.awake.what`, and `chatRenamer.awake.graceDelaySecs`. A value the user set in the editor SHALL win over the host-supplied value, which SHALL win over the default. Changing any of these settings SHALL apply without a reload. `enable` SHALL NOT change whether awake runs: with `variant.enable` false and `awake.when` left at `chatsActive`, an active chat session SHALL still be held awake. The standalone manifest and the Variant manifest SHALL contribute all three settings with the same enums, minimum, and defaults.

#### Scenario: Defaults

- **WHEN** neither setting is set
- **THEN** `awake.when` is `chatsActive`, `awake.what` is `screen`, and `awake.graceDelaySecs` is 60

#### Scenario: Unknown values

- **WHEN** `awake.when` is `always`, `awake.what` is `gpu`, and `awake.graceDelaySecs` is `-1`
- **THEN** the renamer uses `chatsActive`, `screen`, and 60

#### Scenario: Editor wins over the file

- **WHEN** `variants.yaml` sets `chatRenamer.awake.when` to `never` and the user set `chatsActive` in the editor
- **THEN** the renamer uses `chatsActive`

#### Scenario: File wins over the default

- **WHEN** the user set nothing in the editor and `variants.yaml` sets `chatRenamer.awake.what` to `cpu`
- **THEN** the renamer uses `cpu`

#### Scenario: Variant enable stays out of it

- **WHEN** `variant.enable` is false, `awake.when` is `chatsActive`, and a chat session is generating
- **THEN** the machine is held awake

#### Scenario: Manifest copy

- **WHEN** the standalone manifest contributes `chat-renamer.awake.when`, `chat-renamer.awake.what`, and `chat-renamer.awake.graceDelaySecs`
- **THEN** the Variant manifest contributes `variant.awake.when`, `variant.awake.what`, and `variant.awake.graceDelaySecs` with the same enums, minimum, and defaults

#### Scenario: Setting change applies without a reload

- **WHEN** `awake.when` changes from `chatsActive` to `never` while a chat session is generating
- **THEN** the machine is no longer held awake, without a reload

### Requirement: One caffeinate process while a chat session is active

With `awake.when` equal to `chatsActive`, the owning instance SHALL keep the machine awake while at least one chat session is active, and SHALL NOT keep it awake otherwise. A session SHALL count as active while it is taking a turn or generating output, including tool work that belongs to that turn. A session that is only open, selected, or idle SHALL NOT count. Awake SHALL be one child process named `caffeinate`. `awake.what` `screen` SHALL pass the arguments `-disu`. `awake.what` `cpu` SHALL pass the arguments `-dis`. The extension SHALL track that single pid. It SHALL start the process when a session becomes active and no tracked process is running with those arguments. It SHALL NOT start a second process while that one is still running with the same arguments, including when another session becomes active. When the last active session ends, the extension SHALL keep the tracked process until `awake.graceDelaySecs` seconds have passed with no active session, and SHALL then kill it. `0` SHALL kill it at once. A session that becomes active during that delay SHALL keep the same process and cancel the delay. Changing `awake.graceDelaySecs` during the delay SHALL apply the new value measured from when the session went idle, and SHALL kill at once when the new value has already elapsed. When `awake.what` changes while a session is active, the extension SHALL kill the tracked process and start one with the new arguments without waiting. When the tracked process exits on its own while a session is still active, the extension SHALL start one replacement. With `awake.when` equal to `never`, the extension SHALL NOT start a process and SHALL kill a tracked one at once, including during the delay. Disposal of the owner, and loss of ownership, SHALL kill a tracked process at once. An instance that does not own renaming SHALL NOT start a process. A failed start SHALL be logged, SHALL NOT throw out of the extension, and SHALL be tried again the next time a session is active and no process is tracked. When the owner starts, it SHALL check once whether `caffeinate` can be run. When it cannot, the extension SHALL NOT start a process.

#### Scenario: Generation holds the display

- **WHEN** `awake.when` is `chatsActive`, `awake.what` is `screen`, and a chat session starts generating
- **THEN** one `caffeinate -disu` process is running

#### Scenario: Cpu mode

- **WHEN** `awake.what` is `cpu` and a chat session is taking a turn
- **THEN** one `caffeinate -dis` process is running

#### Scenario: Idle chat does not count

- **WHEN** a chat is open and selected and no session is taking a turn or generating
- **THEN** no `caffeinate` process is running

#### Scenario: Tool work stays inside the turn

- **WHEN** a chat session is between tool calls of the same turn and is not generating tokens
- **THEN** the `caffeinate` process started for that turn is still running

#### Scenario: Two sessions, one process

- **WHEN** one chat session is generating and a second session starts a turn
- **THEN** still one `caffeinate` process is running

#### Scenario: Last session ends after the delay

- **WHEN** the only active session finishes its turn and `awake.graceDelaySecs` is 60
- **THEN** that `caffeinate` process is still running
- **AND** 60 seconds later, with no active session, it is no longer running

#### Scenario: Activity during the delay

- **WHEN** a session becomes active again before `awake.graceDelaySecs` elapses
- **THEN** the same `caffeinate` process is still running after the delay would have elapsed

#### Scenario: No delay

- **WHEN** `awake.graceDelaySecs` is 0 and the only active session finishes its turn
- **THEN** that `caffeinate` process is no longer running

#### Scenario: One of two sessions ends

- **WHEN** two sessions are active and one finishes
- **THEN** the same `caffeinate` process is still running

#### Scenario: Mode change replaces the process

- **WHEN** `awake.what` changes from `screen` to `cpu` while a session is generating
- **THEN** the `caffeinate -disu` process is no longer running and one `caffeinate -dis` process is running

#### Scenario: Unexpected exit

- **WHEN** the tracked `caffeinate` process exits while a session is still generating
- **THEN** one new `caffeinate` process is running with the same arguments

#### Scenario: Never

- **WHEN** `awake.when` is `never` and a chat session is generating
- **THEN** no `caffeinate` process is running

#### Scenario: Owner only

- **WHEN** Variant owns renaming and Chat Renamer does not, and a chat session is generating
- **THEN** only the owning instance has started `caffeinate`

#### Scenario: Owner disposed

- **WHEN** the owning instance is disposed while `caffeinate` is running
- **THEN** that process is no longer running

#### Scenario: Start failure

- **WHEN** starting `caffeinate` fails and a session is still active
- **THEN** the extension keeps running, and a later observation of that activity starts one process

#### Scenario: No caffeinate binary

- **WHEN** the owner starts and the system cannot run `caffeinate`, and a chat session later generates
- **THEN** no process is started

### Requirement: Awake activity is logged

Every log line about awake SHALL start with `[awake]`. Starting the process SHALL log, at trace, `+ "caffeinate -disu"` or `+ "caffeinate -dis"`, the pid, and the reason `activity`. Killing it SHALL log, at trace, `+ "kill <pid>"` and a reason of `idle`, `never`, `disposed`, `not owner`, or `mode changed`, and SHALL NOT repeat the `caffeinate` command. An exit of the tracked process while a session is still active SHALL be logged at warn before the replacement is started. A failed start SHALL be logged at error. Starting the idle delay, cancelling it, and the delay elapsing SHALL be logged at trace and SHALL NOT be logged at info or above. When the owner starts, whether `caffeinate` can be run SHALL be logged once at info and SHALL NOT be logged again when a session later generates. Start and kill lines SHALL NOT be logged at info or above.

#### Scenario: Start

- **WHEN** a chat session starts generating and `caffeinate -disu` starts as pid `4242`
- **THEN** the log has a trace line `[awake] + "caffeinate -disu" pid=4242 reason="activity"`

#### Scenario: Idle stop

- **WHEN** the idle delay elapses and pid `4242` is killed
- **THEN** the log has a trace line `[awake] + "kill 4242" reason="idle"`

#### Scenario: Delay is trace

- **WHEN** the only active session finishes and `awake.graceDelaySecs` is 60
- **THEN** the log has a trace line `[awake]` that names the delay 60
- **AND** it has no info line for that delay

#### Scenario: Process exits early

- **WHEN** the tracked process exits while a session is still generating
- **THEN** the log has a warn line `[awake]` for that exit before the replacement start line

#### Scenario: Binary check once at startup

- **WHEN** the owner starts and `caffeinate` cannot be run, then two sessions generate
- **THEN** the log has one info line `[awake]` saying `caffeinate` is unavailable
- **AND** that line is written at startup, before either session generates

#### Scenario: Binary present once at startup

- **WHEN** the owner starts and `caffeinate` can be run, then a session generates
- **THEN** the log has one info line `[awake]` saying `caffeinate` is available
- **AND** the generating session does not add a second binary line
