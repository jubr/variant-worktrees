## MODIFIED Requirements

### Requirement: Variant rows and states

The app SHALL list every variant record, one row each with the slug, a state icon with a text label, the URL when the record has one, and the uptime when it has one, in the sort its host reports. The orders are `name-asc`, `name-desc`, `created-asc`, `created-desc`, `changed-asc` and `changed-desc`. A host that reports none SHALL be treated as `name-asc`. `name` compares slugs, `created` compares `createdMs` and `changed` compares `changedMs`. A missing time SHALL sort as older than every known time. Ascending SHALL be smaller first. An equal key SHALL break the tie by slug ascending. The UI server row stays above the variants. The state SHALL be `watching` when `mode` is `watch` and a watch is alive, `up` when `mode` is `up` and a watch is alive, and `down` otherwise, which includes a recorded mode whose processes are all dead (the row then also says the record is stale). The three states SHALL differ by icon shape and by label, not by colour alone. With no records the app SHALL show an empty state that names `variant create`.

#### Scenario: Watching row

- **WHEN** a record has `mode: watch` and a live watch, a URL and `uptimeSeconds: 125`
- **THEN** its row shows the watching icon and label, the URL and `2m 5s`

#### Scenario: Up row

- **WHEN** a record has `mode: up` and a live watch
- **THEN** its row shows the up icon and label

#### Scenario: Down row

- **WHEN** a record has no `mode`
- **THEN** its row shows the down icon and label and no URL

#### Scenario: Dead processes

- **WHEN** a record has `mode: watch` and every watch has `alive: false`
- **THEN** its row shows the down state and says the record is stale

#### Scenario: Ordering

- **WHEN** the records are `zeta`, `main` and `alpha` and the host reports no sort
- **THEN** the rows are `alpha`, `main`, `zeta`

#### Scenario: Changed descending

- **WHEN** the host reports `changed-desc` and `old` has `changedMs` earlier than `new`
- **THEN** the rows are `new` then `old`

#### Scenario: No variants

- **WHEN** the set of records is empty
- **THEN** the app shows the empty state and no rows

### Requirement: UI server row

When the `main` record has a watch `variant-ui`, the app SHALL show it as a separate row above the variants, labelled with its URL, with an open-link action and, when the app is hosted outside the server it describes, a stop control. A page served by that server SHALL show no stop control on its own row.

#### Scenario: Shown in the editor

- **WHEN** the editor panel receives a `main` record with a live `variant-ui` watch at `http://ui.vw.localhost:62100`
- **THEN** a row for it shows that URL with open and stop controls

#### Scenario: Shown in its own page

- **WHEN** the page served by that server shows the same record
- **THEN** the row shows the URL and no stop control
