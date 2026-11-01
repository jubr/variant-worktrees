## Purpose

What the variants React app shows for each variant and how play, stop and implode behave per state, in the editor panel and in the browser.

## ADDED Requirements

### Requirement: Variant rows and states

The app SHALL list every variant record, `main` first and the rest by slug, one row each with the slug, a state icon with a text label, the URL when the record has one, and the uptime when it has one. The state SHALL be `watching` when `mode` is `watch` and an instance is alive, `up` when `mode` is `up` and an instance is alive, and `down` otherwise, which includes a recorded mode whose processes are all dead (the row then also says the record is stale). The three states SHALL differ by icon shape and by label, not by colour alone. With no records the app SHALL show an empty state that names `variant create`.

#### Scenario: Watching row

- **WHEN** a record has `mode: watch` and a live instance, a URL and `uptimeSeconds: 125`
- **THEN** its row shows the watching icon and label, the URL and `2m 5s`

#### Scenario: Up row

- **WHEN** a record has `mode: up` and a live instance
- **THEN** its row shows the up icon and label

#### Scenario: Down row

- **WHEN** a record has no `mode`
- **THEN** its row shows the down icon and label and no URL

#### Scenario: Dead processes

- **WHEN** a record has `mode: watch` and every instance has `alive: false`
- **THEN** its row shows the down state and says the record is stale

#### Scenario: Ordering

- **WHEN** the records are `zeta`, `main` and `alpha`
- **THEN** the rows are `main`, `alpha`, `zeta`

#### Scenario: No variants

- **WHEN** the set of records is empty
- **THEN** the app shows the empty state and no rows

### Requirement: Controls per state

Each row SHALL offer play, stop and implode. Play SHALL be enabled when the state is `down` or `up` and starts a watch. Stop SHALL be enabled when the state is `watching` or `up` and brings the variant down. Implode SHALL be enabled for every variant except `main`, which has no implode control. While an action of a row is pending, all controls of that row SHALL be disabled and the row SHALL show a busy indicator. Every control SHALL have an accessible name and be operable by keyboard.

#### Scenario: Down variant

- **WHEN** a row is `down`
- **THEN** play and implode are enabled and stop is disabled

#### Scenario: Watching variant

- **WHEN** a row is `watching`
- **THEN** stop and implode are enabled and play is disabled

#### Scenario: Up variant

- **WHEN** a row is `up`
- **THEN** play, stop and implode are enabled

#### Scenario: Main has no implode

- **WHEN** the row is `main`
- **THEN** it shows no implode control

#### Scenario: Pending action

- **WHEN** play was pressed on `demo` and has not settled
- **THEN** every control of `demo` is disabled and a busy indicator shows, and other rows are unaffected

### Requirement: Implode confirmation

Pressing implode SHALL open a confirmation that names the variant and says its database target and worktree are removed. The app SHALL call `implode` with `confirm: true` only after the person accepts, and SHALL do nothing when the person cancels or dismisses it.

#### Scenario: Accepted

- **WHEN** implode is pressed on `demo` and the person accepts
- **THEN** `implode("demo", true)` is called

#### Scenario: Cancelled

- **WHEN** implode is pressed on `demo` and the person cancels
- **THEN** no action is called

### Requirement: UI server row

When the `main` record has an instance `variant-ui`, the app SHALL show it as a separate row above the variants, labelled with its URL, with an open-link action and, when the app is hosted outside the server it describes, a stop control. A page served by that server SHALL show no stop control on its own row.

#### Scenario: Shown in the editor

- **WHEN** the editor panel receives a `main` record with a live `variant-ui` instance at `http://ui.vw.localhost:62100`
- **THEN** a row for it shows that URL with open and stop controls

#### Scenario: Shown in its own page

- **WHEN** the page served by that server shows the same record
- **THEN** the row shows the URL and no stop control

### Requirement: Output and theming

Each row SHALL offer a show-output action that is enabled when the record has a `log`. The app SHALL take its colours and fonts from the editor theme variables when the host provides them and otherwise follow the browser's light or dark preference, and text SHALL remain readable in both.

#### Scenario: Output available

- **WHEN** a record has `log: /work/_v-demo/variants.watch.log`
- **THEN** show-output is enabled and calls `showOutput("demo")`

#### Scenario: No log

- **WHEN** a record has no `log`
- **THEN** show-output is disabled

#### Scenario: Browser dark preference

- **WHEN** the page runs in a browser that prefers a dark scheme and no editor theme variables exist
- **THEN** it renders with a dark palette
