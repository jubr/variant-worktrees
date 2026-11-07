## ADDED Requirements

### Requirement: Choice flags use yes and no

A command argument that selects from a closed set of tokens SHALL be a choice of those tokens, and the allowed tokens SHALL be part of the command definition. A two-token choice SHALL use `yes` and `no`. It SHALL NOT be a boolean. The tokens `true` and `false` SHALL be rejected, and the error SHALL name the allowed tokens. An omitted choice SHALL apply the default recorded for that argument. Presence flags that mean on or off (`force`, `detach`, `verbose`, `reprovision`, and the init step flags) SHALL stay booleans.

`implode` SHALL take a choice `branchRm` whose tokens are `yes` and `no` and whose default is `yes`. The CLI flag SHALL be `--branch-rm` and SHALL have no short flag. `--branch-rm=yes` and `--branch-rm=no` SHALL be accepted. A missing value, `true`, `false`, or any other token SHALL be rejected before `implode` runs, and the error SHALL name `--branch-rm`, `yes`, and `no`. `variant implode --help` SHALL list `--branch-rm` and SHALL name `yes` and `no`.

#### Scenario: Yes is passed through

- **WHEN** a user runs `variant implode --branch-rm=yes demo`
- **THEN** `execute()` receives `{ slug: "demo", branchRm: "yes" }`

#### Scenario: No is passed through

- **WHEN** a user runs `variant implode --branch-rm=no demo`
- **THEN** `execute()` receives `{ slug: "demo", branchRm: "no" }`

#### Scenario: Omitted stays omitted

- **WHEN** a user runs `variant implode demo`
- **THEN** `execute()` receives `{ slug: "demo" }` and does not receive `branchRm`

#### Scenario: Help lists the choice

- **WHEN** a user runs `variant implode --help`
- **THEN** the help text lists `--branch-rm` and names `yes` and `no`

#### Scenario: Boolean tokens rejected

- **WHEN** a user runs `variant implode --branch-rm=true demo` or `variant implode --branch-rm=false demo`
- **THEN** the CLI rejects the flag, the error names `yes` and `no`, and `implode` does not run

#### Scenario: Unknown token rejected

- **WHEN** a user runs `variant implode --branch-rm=maybe demo`
- **THEN** the CLI rejects the flag, the error names `yes` and `no`, and `implode` does not run

#### Scenario: Force stays a boolean

- **WHEN** a user runs `variant implode --force demo`
- **THEN** `execute()` receives `{ slug: "demo", force: true }`
