## MODIFIED Requirements

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

Each row SHALL always show its run control and its implode control. The run control SHALL be the play icon, with accessible name and tooltip `variant watch` plus the slug, when the state is `down`, and it SHALL start a watch. The run control SHALL be a square stop icon when the state is `watching` or `up`, and it SHALL bring the variant down. Exactly one of those two SHALL be shown. The implode control SHALL use an explosion icon, SHALL be shown for every row including `main`, and SHALL be the rightmost of these controls. It SHALL be enabled when the slug is not `main` and `implodeClean` is not false. It SHALL be dimmed and disabled when the slug is `main` or `implodeClean` is false, and its tooltip SHALL remain available while the pointer is over it. The enabled accessible name SHALL say implode would succeed. The disabled accessible name SHALL say implode would fail, or that `main` is never imploded, so the dimming is not the only signal. A disabled implode control SHALL NOT open the confirmation and SHALL NOT call `implode`. While an action of a row is pending, all controls of that row SHALL be disabled and the row SHALL show a busy indicator. Every control SHALL have an accessible name and be operable by keyboard.

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
- **THEN** its explosion control is shown, dimmed, and disabled, and its accessible name says `main` is never imploded

#### Scenario: Dirty implode icon

- **WHEN** `demo` has `implodeClean` false
- **THEN** its explosion control is the rightmost control, dimmed and disabled, and its accessible name says implode would fail

#### Scenario: Clean implode icon

- **WHEN** `demo` has no `implodeClean` or `implodeClean` true
- **THEN** its explosion control is enabled and not dimmed, and its accessible name says implode would succeed

#### Scenario: Disabled implode does nothing

- **WHEN** the explosion control of `main` or of a row with `implodeClean` false is pressed
- **THEN** no confirmation opens and `implode` is not called

#### Scenario: Pending action

- **WHEN** play was pressed on `demo` and has not settled
- **THEN** every control of `demo` is disabled and a busy indicator shows, and other rows are unaffected
