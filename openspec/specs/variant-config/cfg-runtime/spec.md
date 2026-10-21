# variant-config/cfg-runtime Specification

## Purpose
Runtime configuration resolves what a running variant looks like: environment overrides of ports, URLs and pids, instance port resolution with reserved ports, and discovery of the runtime states of all worktrees of a workspace.

## Requirements

### Requirement: Runtime environment overrides
The system SHALL let environment variables override the runtime state of the variant being run: for an instance with key `K`, `VARIANT_<K>_PORT`, `VARIANT_<K>_URL` and `VARIANT_<K>_PID`, where `<K>` is the key with letters uppercased and every other character replaced by `_` (for example `VARIANT_BE_PORT` for `be`, `VARIANT_MY_API_URL` for `my-api`). An override SHALL win over the same value in `variants.local.yaml`, which wins over a derived value. An empty variable SHALL count as unset. A port or pid variable that is not a positive integer, or a URL variable that is not an absolute URL, SHALL fail with an error that names the variable. Overrides SHALL apply only to the instances of the loaded configuration and only to the loaded variant's own state, not to the states found by runtime state discovery.

#### Scenario: Port override wins

- **WHEN** `variants.local.yaml` records port 62060 for `be` and `VARIANT_BE_PORT` is `62099`
- **THEN** the resolved runtime port of `be` is 62099

#### Scenario: Override without a file

- **WHEN** no `variants.local.yaml` exists and `VARIANT_FE_URL` is `http://demo.vw.localhost:62060`
- **THEN** the resolved runtime state holds that URL for `fe`

#### Scenario: Key with a hyphen

- **WHEN** the instance key is `my-api` and `VARIANT_MY_API_PORT` is `62010`
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

### Requirement: Instance port resolution
The system SHALL resolve the port of an instance, by its key, from the first of: the environment variable `VARIANT_<K>_PORT`, `runtime.instances.<key>.port` in the local runtime state, and a random free port between 1024 and 65535 that is not in `variant.reservedPorts`. `variant.reservedPorts` SHALL be an optional list of ports, defaulting to `[3000, 4200, 5432]`, and the resolved configuration SHALL always carry it. The system SHALL NOT write the state when resolving.

#### Scenario: Assigned port

- **WHEN** `runtime.instances.fe.port` is 62060 and the instance key is `fe`
- **THEN** its port is 62060

#### Scenario: No assignment

- **WHEN** neither the environment nor the runtime state holds a port for the instance
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

### Requirement: Runtime state discovery
The system SHALL offer a function that finds the local runtime states of all variants of a workspace. It SHALL read exactly `<root>/<prefix>*/variants.local.yaml`, where `<root>` is the resolved variant root and `<prefix>` the resolved `variant.prefix`, and `<main>/variants.local.yaml`, where `<main>` is the directory of the primary git worktree (a sibling of the prefixed directories, or the root itself when the root holds the main checkout). It SHALL search no other directories. It SHALL return the directory and the resolved `runtime` section of each file that has one, with environment templates replaced as when a single file is read. A file that cannot be read or is invalid SHALL be skipped and reported by directory, without failing the search. Environment overrides SHALL NOT apply to the returned states.

#### Scenario: Prefixed worktrees

- **WHEN** the root holds `_v-demo` and `_v-other`, each with a `variants.local.yaml` carrying a `runtime.slug`, and the prefix is `_v-`
- **THEN** the function returns both, each with its directory

#### Scenario: Main checkout

- **WHEN** the primary worktree is `<root>/variant-worktrees` and it holds a `variants.local.yaml` with `runtime.slug: main`
- **THEN** the function returns it together with the prefixed worktrees

#### Scenario: Root is the main checkout

- **WHEN** the primary worktree is the root itself and the root holds a `variants.local.yaml` with a `runtime`
- **THEN** the function returns it

#### Scenario: Other directories ignored

- **WHEN** `<root>/scratch/variants.local.yaml` and `<root>/_v-demo/packages/x/variants.local.yaml` exist
- **THEN** neither is returned

#### Scenario: Custom prefix

- **WHEN** the prefix is `_work-` and the root holds `_v-old` and `_work-demo`, each with a runtime file
- **THEN** only `_work-demo` and the main checkout are searched

#### Scenario: Invalid file

- **WHEN** one `variants.local.yaml` holds an unknown `runtime` key and another is valid
- **THEN** the valid one is returned and the invalid one is reported with its directory

#### Scenario: File without runtime

- **WHEN** a `variants.local.yaml` has no `runtime` section
- **THEN** it is not returned
