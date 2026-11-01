## Purpose

How the web server starts, ends and records itself as the `variant-ui` instance of the `main` variant, so it is visible and controllable like every other running part of a project.

## ADDED Requirements

### Requirement: Starting the server

`variant ui` SHALL start the server on a free port chosen like an instance port (reserved ports are never picked; `VARIANT_VARIANT_UI_PORT` overrides), bind it to loopback and print the URL `http://ui.<abbr>.localhost:<port>/?token=<token>`. It SHALL run attached until interrupted, or with `--detach` start the server in the background and return after printing the URL. The `variant-ui` instance key SHALL be reserved: a `variants.yaml` that defines an instance with that key SHALL fail validation.

#### Scenario: Attached start

- **WHEN** `variant ui` runs in project `vw`
- **THEN** it prints a URL of the form `http://ui.vw.localhost:<port>/?token=<token>` and keeps running

#### Scenario: Detached start

- **WHEN** `variant ui --detach` runs
- **THEN** it prints the URL and returns while the server keeps serving

#### Scenario: Port override

- **WHEN** `VARIANT_VARIANT_UI_PORT` is `62100`
- **THEN** the server listens on 62100

#### Scenario: Reserved key

- **WHEN** `variants.yaml` defines `variant.instances.variant-ui`
- **THEN** loading the configuration fails validation naming the reserved key

### Requirement: Recording as an instance of main

While running, the server SHALL record itself in the runtime state of the `main` variant as `runtime.instances.variant-ui` with its `port`, `pid` and `url` (without the token). The entry SHALL appear in `variant list` and `variant status main`, with liveness like any other instance. `watch`, `up` and `down` on `main` SHALL keep that entry unchanged, and ending the server SHALL remove only that entry. The token SHALL be kept in an owner-only file next to the project's editor socket, readable by later `variant ui` runs and by the editor, and removed when the server ends.

#### Scenario: Listed

- **WHEN** the server runs on port 62100
- **THEN** `variant list` shows `main` with an instance `variant-ui`, its pid and `url: http://ui.vw.localhost:62100`

#### Scenario: Main's own lifecycle leaves it alone

- **WHEN** `watch` and then `down` run for `main` while the server runs
- **THEN** `runtime.instances.variant-ui` is still present and unchanged

#### Scenario: Removal on exit

- **WHEN** the server is interrupted
- **THEN** the `variant-ui` entry and the token file are gone and the other runtime entries of `main` are unchanged

#### Scenario: Token file mode

- **WHEN** the server runs
- **THEN** the token file is readable and writable by its owner only

### Requirement: One server per project

When a server for the project is already alive, `variant ui` SHALL NOT start a second one. It SHALL print the running server's URL, with the token read from the token file, and exit 0. A recorded entry whose process is dead SHALL count as no server and be replaced.

#### Scenario: Already running

- **WHEN** `variant ui` runs while a server is alive on port 62100
- **THEN** it prints `http://ui.vw.localhost:62100/?token=<token>`, starts nothing and exits 0

#### Scenario: Stale entry

- **WHEN** the recorded `variant-ui` pid is dead and `variant ui` runs
- **THEN** a new server starts and replaces the entry

### Requirement: Stopping the server

`variant ui --stop` SHALL stop the running server of the project, remove its entry and token file, and exit 0, also when no server runs.

#### Scenario: Stop

- **WHEN** `variant ui --stop` runs while the server is alive
- **THEN** the process ends and `variant list` shows no `variant-ui` instance

#### Scenario: Nothing to stop

- **WHEN** `variant ui --stop` runs with no server
- **THEN** it exits 0
