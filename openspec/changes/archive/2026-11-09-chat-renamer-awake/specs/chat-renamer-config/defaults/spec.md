## ADDED Requirements

### Requirement: Awake option defaults and schema

`chat-renamer-config` SHALL own `awake.when`, `awake.what`, and `awake.graceDelaySecs` with the other chat renamer options. `awake.when` SHALL be `chatsActive` or `never`, default `chatsActive`. `awake.what` SHALL be `screen` or `cpu`, default `screen`. `awake.graceDelaySecs` SHALL be an integer of at least 0, default 60. The main entry SHALL export those three defaults and the two enumerations without loading any schema library. The `./schema` entry SHALL accept an optional object `awake` on `ChatRenamerConfigSchema`, with optional `when`, `what`, and `graceDelaySecs`. An absent `awake`, and `awake` with no fields, SHALL be valid. A value outside an enumeration, a `graceDelaySecs` below 0 or not an integer, and an unknown key inside `awake`, SHALL be rejected. The renamer and `variant-config` SHALL take these defaults and this schema from this package instead of defining their own copies.

#### Scenario: Defaults without Zod

- **WHEN** a consumer imports the main entry
- **THEN** it receives `chatsActive`, `screen`, and `60` as the awake defaults and does not load Zod

#### Scenario: Enumerations

- **WHEN** the awake schemas parse `chatsActive`, `never`, `screen`, `cpu`, `always` and `gpu`
- **THEN** they accept the first four and reject `always` and `gpu`

#### Scenario: Empty section

- **WHEN** `ChatRenamerConfigSchema` parses `{}` and `{ awake: {} }`
- **THEN** both are accepted

#### Scenario: Unknown awake key

- **WHEN** `ChatRenamerConfigSchema` parses `{ awake: { colour: "red" } }`
- **THEN** it rejects it

#### Scenario: Grace delay schema

- **WHEN** the grace schema parses `0`, `60`, `-1`, and `1.5`
- **THEN** it accepts `0` and `60` and rejects the other two

#### Scenario: File value

- **WHEN** `variants.yaml` sets `chatRenamer.awake.when` to `never`, `chatRenamer.awake.what` to `cpu`, and `chatRenamer.awake.graceDelaySecs` to `0`
- **THEN** the loaded section is `awake.when` `never`, `awake.what` `cpu`, and `awake.graceDelaySecs` `0`
