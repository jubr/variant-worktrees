# variant-ui/transport Specification

## Purpose

The contract between the variants React app and whatever hosts it, so the same app runs in an editor webview and in a browser tab and behaves the same in both.

## Requirements

### Requirement: Host contract

The app SHALL get everything from a transport supplied by its host: the current set of variant records, notice of every change to that set, a connection state, and the actions `watch(slug)`, `down(slug)`, `implode(slug, confirm)` and `showOutput(slug)`. It SHALL NOT use any other channel. An action SHALL settle with success or with an error message. The app SHALL run unchanged over any transport that satisfies this contract.

#### Scenario: Same app, two hosts

- **WHEN** the same records are supplied by an editor-message transport and by an HTTP transport
- **THEN** the app renders the same rows and the same controls

#### Scenario: Action error

- **WHEN** an action settles with the error `Variant demo is not merged into main`
- **THEN** the app shows that message on the row of the variant and keeps the row's previous state

#### Scenario: Records change

- **WHEN** the transport notifies a new set of records
- **THEN** the app shows the new set without a reload

### Requirement: Connection state

The transport SHALL report `connected`, `connecting` or `disconnected`. While `disconnected`, the app SHALL keep the last records visible, mark them as stale, and disable every action. When the transport reconnects, the app SHALL replace the records with the transport's current set and enable the actions again.

#### Scenario: Server goes away

- **WHEN** the HTTP transport loses its event stream
- **THEN** the rows stay visible, a "disconnected" notice shows, and play, stop and implode are disabled

#### Scenario: Reconnect

- **WHEN** the event stream returns
- **THEN** the notice disappears and the rows show the current records
