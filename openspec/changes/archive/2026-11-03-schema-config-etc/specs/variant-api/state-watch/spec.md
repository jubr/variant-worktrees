## MODIFIED Requirements

### Requirement: Variant snapshot subscription

The library SHALL offer a subscription to the variant records of the project. A subscriber SHALL receive the current records right after subscribing and a new set whenever a record is added, removed or differs in `mode`, `url`, `log`, the watch facts (`port`, `pid`, `url`, `alive`) or any other field except `uptimeSeconds`. A set that equals the previous one, ignoring `uptimeSeconds`, SHALL NOT be delivered. Changes that follow each other within 200 milliseconds SHALL produce one delivery. The records SHALL be those `list` returns.

#### Scenario: Initial delivery

- **WHEN** a caller subscribes while variants `main` and `demo` exist
- **THEN** it receives the records of `main` and `demo` once, without a further change

#### Scenario: Runtime file changes

- **WHEN** `watch` starts for `demo` and rewrites its `variants.local.yaml`
- **THEN** the subscriber receives a set in which `demo` has `mode: watch`

#### Scenario: State file added

- **WHEN** `create` writes the state file of variant `fresh`
- **THEN** the subscriber receives a set that includes `fresh`

#### Scenario: Process dies

- **WHEN** a recorded watch process of `demo` ends without `down` and five seconds pass
- **THEN** the subscriber receives a set in which that watch has `alive: false`

#### Scenario: Uptime alone is not a change

- **WHEN** only the `uptimeSeconds` of `demo` differs from the last set
- **THEN** nothing is delivered

#### Scenario: Burst coalesced

- **WHEN** three runtime files change within 100 milliseconds
- **THEN** one set is delivered
