## MODIFIED Requirements

### Requirement: Awake activity is logged

Every log line about awake SHALL start with `[awake]`. Starting the process SHALL log, at trace, `+ "caffeinate -disu"` or `+ "caffeinate -dis"`, the pid, and the reason `activity`. Killing it SHALL log, at debug, `+ "kill <pid>"` and a reason of `idle`, `never`, `disposed`, `not owner`, or `mode changed`, and SHALL NOT repeat the `caffeinate` command. An exit of the tracked process while a session is still active SHALL be logged at warn before the replacement is started. A failed start SHALL be logged at error. Starting the idle delay, cancelling it, and the delay elapsing SHALL be logged at trace and SHALL NOT be logged at info or above. When the owner starts, whether `caffeinate` can be run SHALL be logged once at info and SHALL NOT be logged again when a session later generates. Start and kill lines SHALL NOT be logged at info or above.

#### Scenario: Start

- **WHEN** a chat session starts generating and `caffeinate -disu` starts as pid `4242`
- **THEN** the log has a trace line `[awake] + "caffeinate -disu" pid=4242 reason="activity"`

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
- **THEN** the log has one info line `[awake]` saying `caffeinate` is unavailable
- **AND** that line is written at startup, before either session generates

#### Scenario: Binary present once at startup

- **WHEN** the owner starts and `caffeinate` can be run, then a session generates
- **THEN** the log has one info line `[awake]` saying `caffeinate` is available
- **AND** the generating session does not add a second binary line
