## ADDED Requirements

### Requirement: Listener emits log events

The listener SHALL emit log events on the shared log stream and SHALL NOT depend on `variant-api` to do so. An invalid JSON line and an invalid request SHALL each emit one `warn` event whose step is `request` and whose message is the same text as the socket error. A second listener that finds a live socket SHALL emit one `error` event whose step is `listen` and whose message names the socket path, and SHALL still fail and leave the live socket in place. A successful request SHALL NOT emit a log event. A handler failure SHALL NOT add a second log event.

#### Scenario: Invalid JSON emits a warning

- **WHEN** a client sends `not-json` followed by a newline and a host is receiving events
- **THEN** the socket response still has a non-empty `error.message`
- **AND** one warn event has step `request` and that same message

#### Scenario: Live socket emits an error

- **WHEN** a listener is already accepting connections and a second listener starts on that path
- **THEN** the second listener fails, the first socket stays, and one error event has step `listen` and names the path

#### Scenario: Success stays quiet

- **WHEN** a client sends a valid request and the handler returns
- **THEN** no log event is emitted for that request
