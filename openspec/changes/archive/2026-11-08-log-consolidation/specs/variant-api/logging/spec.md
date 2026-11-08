## MODIFIED Requirements

### Requirement: Log levels

The library SHALL emit log events at `trace`, `debug`, `info`, `warn`, and `error` through the shared log stream. An event MAY include a step and a slug as fields. The message SHALL NOT repeat that step or that slug inside brackets. A host SHALL be able to receive each event. Emitting an event with no host attached SHALL NOT throw and SHALL NOT write that event to standard output.

#### Scenario: Silent without a host

- **WHEN** the library logs a warning and no host is receiving events
- **THEN** standard output is unchanged and the call does not throw

#### Scenario: Provision names the step

- **WHEN** provisioning variant `demo` logs the schema creation for operation `provision`
- **THEN** the event step is `provision`, the slug is `demo`, and the message does not contain `[demo]` or `[provision]`
