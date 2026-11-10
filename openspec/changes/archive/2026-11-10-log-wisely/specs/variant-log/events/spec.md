## ADDED Requirements

### Requirement: Level set is one enum

The shared levels SHALL be one enum whose members are `trace`, `debug`, `info`, `warn`, and `error`, in that order. Each member's value SHALL be that same word. The package SHALL NOT keep a second handwritten list as the source of those members. `logT`, `logD`, `logI`, `logW`, and `logE` SHALL emit the corresponding member. A log line and a socket `log` request SHALL still use those words.

#### Scenario: Five members in order

- **WHEN** a host reads the shared level set
- **THEN** the values are `trace`, `debug`, `info`, `warn`, and `error`, in that order, and there is no other member

#### Scenario: Info shorthand uses the enum

- **WHEN** a host is receiving events and the info shorthand is called
- **THEN** the event level is the enum member whose value is `info`

### Requirement: Origin is one enum

A log event MAY carry an origin. The origin SHALL be one enum whose members are `cli` and `mcp`, in that order. Each member's value SHALL be that same word. The origin SHALL sit on the same event as the level and the message.

#### Scenario: Two members in order

- **WHEN** a host reads the origin enum
- **THEN** the values are `cli` and `mcp`, in that order, and there is no other member

#### Scenario: Origin rides on the event

- **WHEN** a host is receiving events and an info event is emitted with origin `cli`
- **THEN** the host receives one event whose origin is the enum member whose value is `cli`
