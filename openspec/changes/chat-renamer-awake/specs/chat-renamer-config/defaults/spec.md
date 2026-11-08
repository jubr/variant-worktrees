## ADDED Requirements

### Requirement: Awake option defaults and schema

`chat-renamer-config` SHALL own `awake.when` and `awake.what` with the other chat renamer options. `awake.when` SHALL be `chatsActive` or `never`, default `chatsActive`. `awake.what` SHALL be `screen` or `cpu`, default `screen`. The main entry SHALL export those two defaults and the two enumerations without loading any schema library. The `./schema` entry SHALL accept an optional object `awake` on `ChatRenamerConfigSchema`, with optional `when` and `what`. An absent `awake`, and `awake` with neither field, SHALL be valid. A value outside the enumeration, and an unknown key inside `awake`, SHALL be rejected. The renamer and `variant-config` SHALL take these defaults and this schema from this package instead of defining their own copies.

#### Scenario: Defaults without Zod

- **WHEN** a consumer imports the main entry
- **THEN** it receives `chatsActive` and `screen` as the awake defaults and does not load Zod

#### Scenario: Enumerations

- **WHEN** the awake schemas parse `chatsActive`, `never`, `screen`, `cpu`, `always` and `gpu`
- **THEN** they accept the first four and reject `always` and `gpu`

#### Scenario: Empty section

- **WHEN** `ChatRenamerConfigSchema` parses `{}` and `{ awake: {} }`
- **THEN** both are accepted

#### Scenario: Unknown awake key

- **WHEN** `ChatRenamerConfigSchema` parses `{ awake: { colour: "red" } }`
- **THEN** it rejects it

#### Scenario: File value

- **WHEN** `variants.yaml` sets `chatRenamer.awake.when` to `never` and `chatRenamer.awake.what` to `cpu`
- **THEN** the loaded section is `awake.when` `never` and `awake.what` `cpu`
