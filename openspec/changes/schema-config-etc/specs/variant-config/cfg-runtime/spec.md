## RENAMED Requirements

- FROM: `### Requirement: Instance port resolution`
- TO: `### Requirement: Watch port resolution`

## MODIFIED Requirements

### Requirement: Runtime environment overrides
The system SHALL let environment variables override the runtime state of the variant being run: for a watch with key `K`, `VARIANT_<K>_PORT`, `VARIANT_<K>_URL` and `VARIANT_<K>_PID`, where `<K>` is the key with letters uppercased and every other character replaced by `_` (for example `VARIANT_BE_PORT` for `be`, `VARIANT_MY_API_URL` for `my-api`). An override SHALL win over the same value in `variants.local.yaml`, which wins over a derived value. An empty variable SHALL count as unset. A port or pid variable that is not a positive integer, or a URL variable that is not an absolute URL, SHALL fail with an error that names the variable. Overrides SHALL apply only to the watches of the loaded configuration and only to the loaded variant's own state, not to the states found by runtime state discovery.

#### Scenario: Port override wins

- **WHEN** `variants.local.yaml` records port 62060 for `be` and `VARIANT_BE_PORT` is `62099`
- **THEN** the resolved runtime port of `be` is 62099

#### Scenario: Override without a file

- **WHEN** no `variants.local.yaml` exists and `VARIANT_FE_URL` is `http://demo.vw.localhost:62060`
- **THEN** the resolved runtime state holds that URL for `fe`

#### Scenario: Key with a hyphen

- **WHEN** the watch key is `my-api` and `VARIANT_MY_API_PORT` is `62010`
- **THEN** the resolved runtime port of `my-api` is 62010

#### Scenario: Empty variable ignored

- **WHEN** `VARIANT_BE_PORT` is the empty string
- **THEN** the value from `variants.local.yaml` is used

#### Scenario: Invalid override

- **WHEN** `VARIANT_BE_PORT` is `abc`
- **THEN** loading fails with an error that names `VARIANT_BE_PORT`

#### Scenario: Discovery ignores overrides

- **WHEN** `VARIANT_BE_PORT` is `62099` and runtime state discovery reads another worktree's file that records port 62060 for `be`
- **THEN** the discovered port is 62060

### Requirement: Watch port resolution
The system SHALL resolve the port of a watch, by its key, from the first of: the environment variable `VARIANT_<K>_PORT`, `runtime.watches.<key>.port` in the local runtime state, and a random free port between 1024 and 65535 that is not in `variant.reservedPorts`. `variant.reservedPorts` SHALL be an optional list of ports, defaulting to `[3000, 4200, 5432]`, and the resolved configuration SHALL always carry it. The system SHALL NOT write the state when resolving.

#### Scenario: Assigned port

- **WHEN** `runtime.watches.fe.port` is 62060 and the watch key is `fe`
- **THEN** its port is 62060

#### Scenario: No assignment

- **WHEN** neither the environment nor the runtime state holds a port for the watch
- **THEN** the port is a random free port between 1024 and 65535

#### Scenario: Reserved ports are never picked

- **WHEN** no port is assigned and `variant.reservedPorts` is `[3000, 4200, 5432]`
- **THEN** the picked port is none of 3000, 4200 and 5432

#### Scenario: Custom reserved ports

- **WHEN** `variant.reservedPorts` is `[]`
- **THEN** the picked port may be any free port between 1024 and 65535

#### Scenario: Reserved port assigned explicitly

- **WHEN** `VARIANT_BE_PORT` is 3000 and 3000 is reserved
- **THEN** its port is 3000, because reservation limits only picked ports
