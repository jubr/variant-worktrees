# variant-log/events Specification

## Purpose

One leveled log event for every variant package that has something to report. Hosts attach a sink and decide how to show the event.

## Requirements

### Requirement: Shared log event

`variant-log` SHALL emit events at `trace`, `debug`, `info`, `warn`, and `error`. An event SHALL carry a message and MAY carry a slug and a step. The message SHALL NOT repeat the step or the slug inside brackets. A host SHALL be able to receive each event. Emitting with no host attached SHALL NOT throw and SHALL NOT write the event to standard output. The package SHALL NOT color the event and SHALL NOT depend on `variant-api`.

`logT`, `logD`, `logI`, `logW`, and `logE` SHALL emit `trace`, `debug`, `info`, `warn`, and `error`. `log` SHALL remain for a level chosen by the caller and SHALL accept the same optional slug and step.

#### Scenario: Step and slug are fields

- **WHEN** a host is receiving events and an info event is emitted with message `+ mise install`, step `create`, and slug `add-auth`
- **THEN** the host receives one info event with that message, that step, and that slug
- **AND** the message does not contain `[create]` or `[add-auth]`

#### Scenario: Info shorthand

- **WHEN** a host is receiving events and the info shorthand is called with message `ready` and slug `demo`
- **THEN** the host receives one event at `info` with that message and that slug

#### Scenario: Shorthand is silent without a host

- **WHEN** the warn shorthand is called and no host is receiving events
- **THEN** standard output is unchanged and the call does not throw

#### Scenario: Chosen level still emits

- **WHEN** a host is receiving events and the caller emits `error` by passing that level, with step `listen`
- **THEN** the host receives one event at `error` with that step
