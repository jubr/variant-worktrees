## ADDED Requirements

### Requirement: Level shorthands

The library SHALL provide `logT`, `logD`, `logI`, `logW`, and `logE`. Each SHALL emit one event at `trace`, `debug`, `info`, `warn`, and `error` respectively, with the message and the optional slug given by the caller. The leveled `log` operation SHALL remain for a level chosen by the caller. With no host attached, a shorthand SHALL NOT throw and SHALL NOT write the event to standard output.

#### Scenario: Info shorthand

- **WHEN** a host is receiving events and the info shorthand is called with message `ready` and slug `demo`
- **THEN** the host receives one event at `info` with that message and that slug

#### Scenario: Shorthand is silent without a host

- **WHEN** the warn shorthand is called and no host is receiving events
- **THEN** standard output is unchanged and the call does not throw

#### Scenario: Chosen level still emits

- **WHEN** a host is receiving events and the caller emits `error` by passing that level
- **THEN** the host receives one event at `error`
