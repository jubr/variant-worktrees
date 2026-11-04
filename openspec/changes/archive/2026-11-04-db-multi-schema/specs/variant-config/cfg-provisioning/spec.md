## MODIFIED Requirements

### Requirement: Provisioning steps

The system SHALL accept an optional map `variant.steps`, keyed by step name. A name SHALL match `^[A-Za-z0-9_-]{2,20}$`. The builtin steps `create`, `provision`, `seed`, `watch`, `down`, `deprovision` and `implode` are an internal steps map. A `variant.steps` entry of the same name overlays that step and SHALL NOT fail validation. `runBefore` and `runAfter` on a builtin name SHALL fail validation. Two names that map to the same environment variable segment (letters uppercased, every other character replaced by `_`) SHALL fail validation. A custom step has a required `cmd` (shell commands) and exactly one of `runBefore` and `runAfter`. A builtin overlay may omit `cmd` and then keeps `${builtin.step.<name>}`. Either has an optional `dir` (a path relative to the worktree, default the worktree root, never absolute or climbing out of it), `env` (a map of templated values) and `filterLinesRegex` (a regular expression). A builtin overlay SHALL NOT set `runBefore` or `runAfter`. `runBefore` and `runAfter` SHALL name a builtin step (`create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`) or another step in the map, and SHALL NOT name the step itself. A custom step that sets neither SHALL fail validation. A `run` key with no `cmd` SHALL be read as `cmd`. Unknown keys, including the former `show` and `unlessEnv`, SHALL be ignored with a warning, and a `run` key SHALL be ignored with a warning. A list, which is the former shape of `variant.steps`, SHALL fail validation.

#### Scenario: Valid steps

- **WHEN** `variant.steps` holds `migrations: { cmd: "bun run migrate", dir: server, filterLinesRegex: "^Migration ", runAfter: seed }`
- **THEN** loading succeeds and the step is carried unchanged

#### Scenario: Duplicate names

- **WHEN** two steps are named `migrations`
- **THEN** loading the configuration fails validation naming the duplicate

#### Scenario: Colliding segments

- **WHEN** the map has both `db-seed` and `db_seed`
- **THEN** loading the configuration fails validation naming both

#### Scenario: Name with other characters

- **WHEN** a step is named `run migrations` or `a.b` or `a`
- **THEN** loading the configuration fails validation

#### Scenario: Name too long

- **WHEN** a step name is 21 characters
- **THEN** loading the configuration fails validation

#### Scenario: Reserved builtin name

- **WHEN** a step is named `watch` and sets `dir: server` and no `cmd`
- **THEN** loading succeeds and the resolved `watch` command stays `${builtin.step.watch}`

#### Scenario: Invalid pattern

- **WHEN** a step `filterLinesRegex` is not a valid regular expression
- **THEN** loading the configuration fails validation

#### Scenario: Former keys refused

- **WHEN** a step sets `show` or `unlessEnv`
- **THEN** loading succeeds, neither key takes effect and one warning names each

#### Scenario: Former keys

- **WHEN** a step sets `show`, `unlessEnv` or `run` next to `cmd`
- **THEN** loading succeeds, none of those keys takes effect, and one warning names each

#### Scenario: Former run key

- **WHEN** a step sets `run: bun run migrate` and no `cmd`
- **THEN** loading succeeds, the step's command is `bun run migrate`, and one warning names `run`

#### Scenario: Former list

- **WHEN** `variant.steps` is a list of `{ name, run }` entries
- **THEN** loading the configuration fails validation

#### Scenario: Placement names a known step

- **WHEN** a step sets `runBefore: watch`
- **THEN** loading succeeds

#### Scenario: Placement names nothing

- **WHEN** a step sets `runAfter: missing`
- **THEN** loading the configuration fails validation naming `missing`

#### Scenario: Both placements

- **WHEN** a step sets `runBefore` and `runAfter`
- **THEN** loading the configuration fails validation

#### Scenario: Custom step names no placement

- **WHEN** a step `migrations` sets `cmd: bun run migrate` and neither `runBefore` nor `runAfter`
- **THEN** loading the configuration fails validation

#### Scenario: Placement names itself

- **WHEN** the step `migrations` sets `runAfter: migrations`
- **THEN** loading the configuration fails validation

#### Scenario: Fixed phases are not moved

- **WHEN** a builtin step, including `provision`, `seed`, `deprovision`, `watch` or `implode`, sets `runBefore` or `runAfter`
- **THEN** loading the configuration fails validation

### Requirement: Resolved steps

The system SHALL keep an internal steps map with one entry per builtin step, in the order `create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`. Each internal `cmd` SHALL be `${builtin.step.create}`, `${builtin.step.provision}`, `${builtin.step.seed}`, `${builtin.step.watch}`, `${builtin.step.down}`, `${builtin.step.deprovision}` or `${builtin.step.implode}`. The resolved steps SHALL be that map with `variant.steps` merged on top: a user `cmd`, `dir` or `filterLinesRegex` replaces the internal value, a user `env` merges with the user key winning, and a user step that omits `cmd` keeps the internal `${builtin.step.<name>}`. A custom step SHALL be inserted at its `runBefore` or `runAfter` place. `variant config` SHALL print this resolved map as `variant.steps`. `${builtin.step.<name>}` SHALL be the builtin implementation of that step, not a shell command.

#### Scenario: Config shows every builtin step

- **WHEN** `variant.steps` is absent and `variant config` runs
- **THEN** the printed `variant.steps` holds `create`, `provision`, `seed`, `watch`, `down`, `deprovision` and `implode` in that order, and each `cmd` is `${builtin.step.<name>}` for that name

#### Scenario: User command replaces the builtin command

- **WHEN** `variant.steps.provision.cmd` is `bun run db:provision` and `variant config` runs
- **THEN** the printed `provision` command is `bun run db:provision` and the printed `seed` command is `${builtin.step.seed}`

#### Scenario: User env keeps the builtin command

- **WHEN** `variant.steps.provision` sets `env` and no `cmd`
- **THEN** the resolved `provision` command is `${builtin.step.provision}` and the resolved env holds the user keys

#### Scenario: Custom step is inserted

- **WHEN** a step `migrations` sets `runAfter: seed`
- **THEN** the resolved steps place `migrations` immediately after `seed` and before `watch`
