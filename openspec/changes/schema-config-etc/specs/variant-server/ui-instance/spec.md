## RENAMED Requirements

- FROM: `### Requirement: Recording as an instance of main`
- TO: `### Requirement: Recording as a watch of main`

## MODIFIED Requirements

### Requirement: Starting the server

`variant ui` SHALL start the server on the first of: the environment variable `VARIANT_UI_PORT`, the setting `variant.ui.port`, and a free port that is not in `variant.reservedPorts`. A port that is named explicitly is kept even when reserved, as for any watch. An empty `VARIANT_UI_PORT` SHALL count as unset; a value that is not a port number SHALL fail with an error that names the variable. The server SHALL bind to loopback and `variant ui` SHALL print the URL `http://ui.<abbr>.localhost:<port>/?token=<token>`. It SHALL run attached until interrupted, or with `--detach` start the server in the background and return after printing the URL. The `variant-ui` watch key SHALL be reserved, and so SHALL every watch key whose environment segment is `UI` (such as `ui`), because `VARIANT_UI_PORT` belongs to the server: a `variants.yaml` that defines a watch with such a key SHALL fail validation.

#### Scenario: Attached start

- **WHEN** `variant ui` runs in project `vw`
- **THEN** it prints a URL of the form `http://ui.vw.localhost:<port>/?token=<token>` and keeps running

#### Scenario: Detached start

- **WHEN** `variant ui --detach` runs
- **THEN** it prints the URL and returns while the server keeps serving

#### Scenario: Port override

- **WHEN** `VARIANT_UI_PORT` is `62100`
- **THEN** the server listens on 62100

#### Scenario: Port from the configuration

- **WHEN** `variants.yaml` sets `variant.ui.port: 62101` and `VARIANT_UI_PORT` is not set
- **THEN** the server listens on 62101

#### Scenario: Environment wins over the configuration

- **WHEN** `variant.ui.port` is `62101` and `VARIANT_UI_PORT` is `62100`
- **THEN** the server listens on 62100

#### Scenario: Invalid port variable

- **WHEN** `VARIANT_UI_PORT` is `abc`
- **THEN** `variant ui` fails with an error that names `VARIANT_UI_PORT`

#### Scenario: Reserved key

- **WHEN** `variants.yaml` defines `variant.watches.variant-ui`
- **THEN** loading the configuration fails validation naming the reserved key

#### Scenario: Instance key that would share the server's variable

- **WHEN** `variants.yaml` defines `variant.watches.ui`
- **THEN** loading the configuration fails validation naming the key and `VARIANT_UI_PORT`

### Requirement: Recording as a watch of main

While running, the server SHALL record itself in the runtime state of the `main` variant as `runtime.watches.variant-ui` with its `port`, `pid` and `url` (without the token). The entry SHALL appear in `variant list` and `variant status main`, with liveness like any other watch. `watch`, `up` and `down` on `main` SHALL keep that entry unchanged, and ending the server SHALL remove only that entry. The token SHALL be kept in an owner-only file next to the project's editor socket, readable by later `variant ui` runs and by the editor, and removed when the server ends.

#### Scenario: Listed

- **WHEN** the server runs on port 62100
- **THEN** `variant list` shows `main` with a watch `variant-ui`, its pid and `url: http://ui.vw.localhost:62100`

#### Scenario: Main's own lifecycle leaves it alone

- **WHEN** `watch` and then `down` run for `main` while the server runs
- **THEN** `runtime.watches.variant-ui` is still present and unchanged

#### Scenario: Removal on exit

- **WHEN** the server is interrupted
- **THEN** the `variant-ui` entry and the token file are gone and the other runtime entries of `main` are unchanged

#### Scenario: Token file mode

- **WHEN** the server runs
- **THEN** the token file is readable and writable by its owner only

### Requirement: Stopping the server

`variant ui --stop` SHALL stop the running server of the project, remove its entry and token file, and exit 0, also when no server runs.

#### Scenario: Stop

- **WHEN** `variant ui --stop` runs while the server is alive
- **THEN** the process ends and `variant list` shows no `variant-ui` watch

#### Scenario: Nothing to stop

- **WHEN** `variant ui --stop` runs with no server
- **THEN** it exits 0
