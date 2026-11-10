## MODIFIED Requirements

### Requirement: A before-startup decision is logged at trace

When the title event trigger ignores a chat because its first prompt was submitted before the renamer started listening, the renamer SHALL write that decision at `trace` level, in category `title-event`, with message `decision`, `decision="ignore"` and `reason="before startup"`. It SHALL NOT write that decision at `debug` or at `info`. A decision for any other reason SHALL keep its level: `no first prompt`, `too old`, and `rename request` at `debug`, `current title shares the base`, `no rename request`, and `malformed request` at `info`, and `title event failed` at `error`. Later title events of the same chat SHALL log no decision.

#### Scenario: Existing chat at editor load

- **WHEN** a title event reports a chat whose first prompt was submitted before the renamer started
- **THEN** a `trace` entry in `[title-event]` has `decision="ignore"` and `reason="before startup"`
- **AND** no `debug` or `info` decision entry is written for that chat

#### Scenario: Unreadable prompt stays at debug

- **WHEN** a title event reports a chat whose first prompt cannot be read
- **THEN** the decision entry is at `debug` with `reason="no first prompt"`
- **AND** it is not at `trace`

#### Scenario: New chat stays at info

- **WHEN** a new chat's first prompt matches a rename request and the chat is renamed
- **THEN** the decision entry is at `debug` with `reason="rename request"`
- **AND** it is not at `info`
