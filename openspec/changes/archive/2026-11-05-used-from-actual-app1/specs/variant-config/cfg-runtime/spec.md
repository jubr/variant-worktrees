## MODIFIED Requirements

### Requirement: Runtime environment overrides
The system SHALL let environment variables override the runtime state of the variant being run: for a watch with key `K`, `VARIANT_<K>_PORT`, `VARIANT_<K>_URL` and `VARIANT_<K>_PID`, where `<K>` is the key with letters uppercased and every other character replaced by `_` (for example `VARIANT_BE_PORT` for `be`, `VARIANT_MY_API_URL` for `my-api`). An override SHALL win over the same value in `.cache/variant/state.yaml`, which wins over a derived value. An empty variable SHALL count as unset. A port or pid variable that is not a positive integer, or a URL variable that is not an absolute URL, SHALL fail with an error that names the variable. Overrides SHALL apply only to the watches of the loaded configuration and only to the loaded variant's own state, not to the states found by runtime state discovery.

#### Scenario: Port override wins

- **WHEN** `state.yaml` records port 62060 for `be` and `VARIANT_BE_PORT` is `62099`
- **THEN** the resolved runtime port of `be` is 62099

#### Scenario: Override without a file

- **WHEN** no `state.yaml` exists and `VARIANT_FE_URL` is `http://demo.vw.localhost:62060`
- **THEN** the resolved runtime state holds that URL for `fe`

#### Scenario: Key with a hyphen

- **WHEN** the watch key is `my-api` and `VARIANT_MY_API_PORT` is `62010`
- **THEN** the resolved runtime port of `my-api` is 62010

#### Scenario: Empty variable ignored

- **WHEN** `VARIANT_BE_PORT` is the empty string
- **THEN** the value from `state.yaml` is used

#### Scenario: Invalid override

- **WHEN** `VARIANT_BE_PORT` is `abc`
- **THEN** loading fails with an error that names `VARIANT_BE_PORT`

#### Scenario: Discovery ignores overrides

- **WHEN** `VARIANT_BE_PORT` is `62099` and runtime state discovery reads another worktree's file that records port 62060 for `be`
- **THEN** the discovered port is 62060

### Requirement: Runtime state discovery
The system SHALL offer a function that finds the local runtime states of all variants of a workspace. It SHALL read exactly `<root>/<prefix>*/.cache/variant/state.yaml`, where `<root>` is the resolved variant root and `<prefix>` the resolved `variant.prefix`, and `<main>/.cache/variant/state.yaml`, where `<main>` is the directory of the primary git worktree (a sibling of the prefixed directories, or the root itself when the root holds the main checkout). It SHALL search no other directories. It SHALL return the directory and the operational state of each file that has one. A file that cannot be read or is invalid SHALL be skipped and reported by directory, without failing the search. Environment overrides SHALL NOT apply to the returned states. When `state.yaml` is absent in a directory that would otherwise be searched, the function SHALL use the legacy read of `variants.local.yaml` in that same directory, and SHALL NOT search `.cache/variants/` as a directory of its own.

#### Scenario: Prefixed worktrees

- **WHEN** the root holds `_v-demo` and `_v-other`, each with a `.cache/variant/state.yaml` carrying a `slug`, and the prefix is `_v-`
- **THEN** the function returns both, each with its directory

#### Scenario: Main checkout

- **WHEN** the primary worktree is `<root>/app` and it holds a `.cache/variant/state.yaml` with `slug: main`
- **THEN** the function returns it together with the prefixed worktrees

#### Scenario: Root is the main checkout

- **WHEN** the primary worktree is the root itself and the root holds a `.cache/variant/state.yaml`
- **THEN** the function returns it

#### Scenario: Other directories ignored

- **WHEN** `<root>/scratch/.cache/variant/state.yaml` and `<root>/_v-demo/packages/x/.cache/variant/state.yaml` exist
- **THEN** neither is returned

#### Scenario: Custom prefix

- **WHEN** the prefix is `_work-` and the root holds `_v-old` and `_work-demo`, each with a state file
- **THEN** only `_work-demo` and the main checkout are searched

#### Scenario: Invalid file

- **WHEN** one `state.yaml` holds an unknown key and another is valid
- **THEN** the valid one is returned and the invalid one is reported with its directory

#### Scenario: Legacy file

- **WHEN** `_v-demo` has no `state.yaml` and has `variants.local.yaml` with `runtime.slug: demo`
- **THEN** the function returns `demo`

#### Scenario: File without runtime

- **WHEN** a searched `state.yaml` has no `slug`
- **THEN** it is not returned

### Requirement: Watch port resolution
The system SHALL resolve the port of a watch, by its key, from the first of: the environment variable `VARIANT_<K>_PORT`, `watches.<key>.port` in `.cache/variant/state.yaml`, and a free port of `variant.ports.range`. The free port SHALL be found by trying the ports of the range in order, starting at a random offset and wrapping around, and taking the first that the operating system reports as free. When no port of the range is free the system SHALL fail with an error that names the range. A port that is assigned through the environment or the state file SHALL be kept even when it lies outside the range, and no port is otherwise excluded. The system SHALL NOT write the state when resolving.

#### Scenario: Assigned port

- **WHEN** `watches.fe.port` in `state.yaml` is 62060 and the watch key is `fe`
- **THEN** its port is 62060

#### Scenario: No assignment

- **WHEN** neither the environment nor the state file holds a port for the watch and `variant.ports` is absent
- **THEN** the port is a free port between 42000 and 42999

#### Scenario: Custom range

- **WHEN** `variant.ports.range` is `43100-43109` and no port is assigned
- **THEN** the picked port is a free port between 43100 and 43109

#### Scenario: Range exhausted

- **WHEN** every port of the range is in use
- **THEN** resolving fails with an error that names the range

#### Scenario: Assigned port outside the range

- **WHEN** `VARIANT_BE_PORT` is 3000 and the range is `42000-42999`
- **THEN** its port is 3000
