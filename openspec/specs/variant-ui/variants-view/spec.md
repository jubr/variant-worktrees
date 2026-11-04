# variant-ui/variants-view Specification

## Purpose

What the variants React app shows for each variant and how play, stop and implode behave per state, in the editor panel and in the browser.

## Requirements

### Requirement: Variant rows and states

The app SHALL list every variant record, one row each with the slug, a state icon with a text label, the URL when the record has one, and the uptime when it has one. The orders are `name-asc`, `name-desc`, `created-asc`, `created-desc`, `changed-asc` and `changed-desc`. A host that reports none SHALL be treated as `name-asc`. `name` compares slugs, `created` compares `createdMs` and `changed` compares `changedMs`. A missing time SHALL sort as older than every known time. Ascending SHALL be smaller first. An equal key SHALL break the tie by slug ascending. A record whose slug is `main` SHALL be labelled `main` and SHALL stay the first variant row regardless of that order. The UI server row stays above the variants. The app SHALL NOT invent a `main` row when the records do not include one. The state SHALL be `watching` when `mode` is `watch` and a watch is alive, `up` when `mode` is `up` and a watch is alive, and `down` otherwise, which includes a recorded mode whose processes are all dead (the row then also says the record is stale). `down` SHALL use a hollow dot, `watching` SHALL use a filled green dot, and `up` SHALL use an icon of a different shape. The text label SHALL name the state, so the green fill is not the only signal. With no records the app SHALL show an empty state that names `variant create`.

#### Scenario: Watching row

- **WHEN** a record has `mode: watch` and a live watch, a URL and `uptimeSeconds: 125`
- **THEN** its row shows a filled green dot, the label `watching`, the URL and `2m 5s`

#### Scenario: Up row

- **WHEN** a record has `mode: up` and a live watch
- **THEN** its row shows the up icon, a different shape from the hollow and filled dots, and the label `up`

#### Scenario: Down row

- **WHEN** a record has no `mode`
- **THEN** its row shows a hollow dot and the label `down` and no URL

#### Scenario: Dead processes

- **WHEN** a record has `mode: watch` and every watch has `alive: false`
- **THEN** its row shows the down state and says the record is stale

#### Scenario: Ordering

- **WHEN** the records are `zeta`, `main` and `alpha` and the host reports no sort
- **THEN** the rows are `main`, `alpha`, `zeta`

#### Scenario: Changed descending

- **WHEN** the host reports `changed-desc` and `old` has `changedMs` earlier than `new`
- **THEN** `new` is listed before `old`, and `main` is listed before both when it is present

#### Scenario: No main record

- **WHEN** the records are `zeta` and `alpha` and the host reports no sort
- **THEN** the rows are `alpha`, `zeta` and there is no `main` row

#### Scenario: No variants

- **WHEN** the set of records is empty
- **THEN** the app shows the empty state and no rows

### Requirement: Controls per state

Each row SHALL always show its run control. Each row other than `main` SHALL always show its implode control. The run control SHALL be the play icon, with accessible name and tooltip `variant watch` plus the slug, when the state is `down`, and it SHALL start a watch. The run control SHALL be a square stop icon when the state is `watching` or `up`, and it SHALL bring the variant down. Exactly one of those two SHALL be shown. The implode control SHALL use an explosion icon and SHALL be the rightmost of these controls. The `main` row SHALL show no implode control. Every other row SHALL show the explosion. It SHALL be enabled when `implodeClean` is not false. It SHALL be muted and disabled when `implodeClean` is false, and its tooltip SHALL remain available while the pointer is over it. The enabled accessible name SHALL say implode would succeed. The muted accessible name SHALL say implode would fail, so the muting is not the only signal. A muted implode control SHALL NOT open the confirmation and SHALL NOT call `implode`. While an action of a row is pending, all controls of that row SHALL be disabled and the row SHALL show a busy indicator. Every control SHALL have an accessible name and be operable by keyboard.

#### Scenario: Down variant

- **WHEN** a clean row other than `main` is `down`
- **THEN** play and the explosion control are shown and enabled, and stop is not shown

#### Scenario: Watching variant

- **WHEN** a clean row other than `main` is `watching`
- **THEN** the square stop and the explosion control are shown and enabled, and play is not shown

#### Scenario: Up variant

- **WHEN** a clean row other than `main` is `up`
- **THEN** the square stop and the explosion control are shown and enabled, and play is not shown

#### Scenario: Main has no implode

- **WHEN** the row is `main`
- **THEN** it shows no implode control

#### Scenario: Dirty implode icon

- **WHEN** `demo` has `implodeClean` false
- **THEN** its explosion control is the rightmost control, muted and disabled, and its accessible name says implode would fail

#### Scenario: Clean implode icon

- **WHEN** `demo` has no `implodeClean` or `implodeClean` true
- **THEN** its explosion control is enabled and not muted, and its accessible name says implode would succeed

#### Scenario: Disabled implode does nothing

- **WHEN** the muted explosion control of a row with `implodeClean` false is pressed
- **THEN** no confirmation opens and `implode` is not called

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

When the `main` record has a watch `variant-ui`, the app SHALL show it as a separate row above the variants, labelled with its URL, with an open-link action and, when the app is hosted outside the server it describes, a stop control. A page served by that server SHALL show no stop control on its own row.

#### Scenario: Shown in the editor

- **WHEN** the editor panel receives a `main` record with a live `variant-ui` watch at `http://ui.vw.localhost:62100`
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
