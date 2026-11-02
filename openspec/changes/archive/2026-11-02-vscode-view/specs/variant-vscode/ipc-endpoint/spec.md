## MODIFIED Requirements

### Requirement: Lifecycle commands are not handled here

The extension's socket SHALL NOT execute `config`, `create`, `list`, `provision`, `up`, `down`, `watch`, or `implode`. A socket request with one of those names SHALL fail and SHALL NOT call `variant-api`. This restriction applies to requests that arrive on the socket only: the extension's own views MAY call `variant-api` in-process for `list`, `watch`, `down` and `implode`, and those calls SHALL NOT be reachable from the socket.

#### Scenario: Create is refused

- **WHEN** a client sends `{"name":"create","args":{"slug":"test-feature"}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` create does not run

#### Scenario: List is refused

- **WHEN** a client sends `{"name":"list","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` list does not run

#### Scenario: Implode is refused

- **WHEN** a client sends `{"name":"implode","args":{"slug":"test-feature"}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` implode does not run

#### Scenario: Watch is refused

- **WHEN** a client sends `{"name":"watch","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` watch does not run

#### Scenario: View actions do not use the socket

- **WHEN** a person presses play on a variant in the Variants view
- **THEN** the extension runs the watch in-process and the socket is not involved
- **AND** a socket request named `watch` still fails
