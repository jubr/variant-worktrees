# variant-api/state-watch Specification

## Purpose

A subscription that tells callers the current set of variants and every change to it, so editor views and web pages stay current without polling the library on their own.

## Requirements

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

### Requirement: Subscription failure and teardown

When reading the records fails, the subscriber SHALL receive the error and keep the last set it had, and the next successful read SHALL clear the error and deliver the set. Ending a subscription SHALL stop its file watching and timers, and no delivery SHALL follow. Several subscribers of one client SHALL share one set of watchers.

#### Scenario: Database unreachable

- **WHEN** reading the records fails because the database cannot be reached
- **THEN** the subscriber receives an error and its last set remains valid, and when the database returns the error is cleared

#### Scenario: Unsubscribe

- **WHEN** a subscriber ends its subscription and a runtime file then changes
- **THEN** that subscriber receives nothing

#### Scenario: Shared watchers

- **WHEN** two subscribers use one client
- **THEN** one file watcher per watched path exists, and both receive each change
