## MODIFIED Requirements

### Requirement: Down

The system SHALL provide `down` for a slug that stops every recorded host process with its descendants, removes the variant's containers and its network, and removes the `runtime` section from `variants.local.yaml` while keeping other top-level keys. For a slug other than `main` it SHALL then deprovision the variant: drop its database target, and when `db.multi` is set, every schema the multi-schema capability names. It SHALL keep the storage directory and the variant state. For slug `main` it SHALL stop the runtime and SHALL NOT drop a schema. A variant that has nothing running and nothing to drop SHALL succeed without changes.

#### Scenario: Down after watch

- **WHEN** slug `demo` runs a detached watch and `down` runs for `demo`
- **THEN** the processes are terminated, the file has no `runtime` section, and the database target of `demo` is dropped

#### Scenario: Down after up

- **WHEN** slug `demo` runs containers and `down` runs
- **THEN** the containers and network `v-net-demo` are removed and the database target of `demo` is dropped

#### Scenario: Nothing running

- **WHEN** `down` runs for a slug with no runtime state and no database target
- **THEN** the call succeeds and reports nothing stopped

#### Scenario: Stale pid

- **WHEN** the recorded pid no longer exists
- **THEN** `down` ignores it and still clears the runtime state

#### Scenario: Main keeps its schema

- **WHEN** `down` runs for slug `main`
- **THEN** the runtime stops and the schema of `main` still exists

#### Scenario: Storage and state stay

- **WHEN** `down` runs for `demo`, whose storage directory holds a file and whose state file exists
- **THEN** the schema is dropped, the file remains, and the state file remains
