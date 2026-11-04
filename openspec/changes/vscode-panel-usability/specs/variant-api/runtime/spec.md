## MODIFIED Requirements

### Requirement: Runtime state recording

The system SHALL write the `runtime` section of the variant's `variants.local.yaml` (in the variant's worktree, next to its `variants.yaml`) after watches start: `slug`, `mode` (`up` or `watch`), `dir` (the worktree path), `db` (dialect and target) and, for every watch by key, `port`, the rendered `url` when it has a `url` template, `startedAt`, and, for host processes, `pid`. `startedAt` SHALL be the local time that watch started, formatted `YYYY-MM-DD_HH:MM:SS` (zero-padded date, underscore, zero-padded 24-hour time, no timezone suffix). An existing `runtime.createdAt` SHALL be kept. Other top-level keys of the file SHALL be kept.

#### Scenario: Written after up

- **WHEN** `up` finishes for slug `demo` with `fe` on port 62060 and a `url` template
- **THEN** `variants.local.yaml` holds `runtime.mode: up`, `runtime.slug: demo` and `runtime.watches.fe` with port 62060 and `url: http://demo.vw.localhost:62060`

#### Scenario: Pids written for watch

- **WHEN** `watch` starts host processes
- **THEN** each watch entry holds the `pid` of its process

#### Scenario: Start time written

- **WHEN** `watch` starts `fe` at 12:30:00 local time on 2026-11-04
- **THEN** `runtime.watches.fe.startedAt` is `2026-11-04_12:30:00`

#### Scenario: Created time kept

- **WHEN** `runtime.createdAt` is `2026-01-02_03:04:05` and `watch` rewrites the runtime section
- **THEN** `runtime.createdAt` is still `2026-01-02_03:04:05`

#### Scenario: Other keys kept

- **WHEN** the file has another top-level key before `up` runs
- **THEN** that key is unchanged afterwards
