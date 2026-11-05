## MODIFIED Requirements

### Requirement: Subscription failure and teardown

When reading the records fails for a reason other than the configured database being unreachable, the subscriber SHALL receive the error and keep the last set it had, and the next successful read SHALL clear the error and deliver the set. When the configured database cannot be contacted, that read SHALL NOT be a failure: the subscriber SHALL receive the records `list` returns in that case, no error, and the database contact warning, and SHALL receive a new set with that warning cleared when the database can be contacted again. Ending a subscription SHALL stop its file watching and timers, and no delivery SHALL follow. Several subscribers of one client SHALL share one set of watchers.

#### Scenario: Database unreachable

- **WHEN** variant `demo` has a state file, schema `v_orphan` has no state file, and the database cannot be contacted
- **THEN** the subscriber receives a set that includes `demo`, does not include `orphan`, has no error, and includes the contact warning
- **AND** when the database can be contacted again and holds `v_orphan`, the subscriber receives a set that includes `orphan` and does not include the contact warning

#### Scenario: Other read failure keeps the last set

- **WHEN** a read fails for a reason other than the database being unreachable
- **THEN** the subscriber receives an error and its last set remains valid, and when a later read succeeds the error is cleared

#### Scenario: Unsubscribe

- **WHEN** a subscriber ends its subscription and a runtime file then changes
- **THEN** that subscriber receives nothing

#### Scenario: Shared watchers

- **WHEN** two subscribers use one client
- **THEN** one file watcher per watched path exists, and both receive each change
