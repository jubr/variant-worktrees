## Purpose

An editor panel that shows the variants React app in a webview, and a command that opens the web page of a running UI server.

## ADDED Requirements

### Requirement: Variants panel

The command `Variant: Open Variants Panel` SHALL open one webview panel that renders the variants app and wires it to the extension through the editor-message transport, so the panel shows the same records, the same `variant.sort` order and runs the same actions as the Variants view. Changing `variant.sort` while the panel is open SHALL reorder it. Running the command again SHALL reveal the existing panel. The webview SHALL load only scripts and styles from the extension's own files, under a content security policy with a per-load nonce, and SHALL use the editor theme variables. Closing the panel SHALL end its subscription.

#### Scenario: Open

- **WHEN** the command runs
- **THEN** a panel opens that lists the same variants as the Variants view

#### Scenario: Reveal instead of duplicate

- **WHEN** the command runs while the panel is open
- **THEN** that panel is revealed and no second panel opens

#### Scenario: Sort follows the setting

- **WHEN** `variant.sort` changes to `name-desc` while the panel is open
- **THEN** the panel lists the variants in that order

#### Scenario: Same actions

- **WHEN** a person presses play in the panel on `demo`
- **THEN** a detached watch of `demo` starts and both the panel and the Variants view show `watching`

#### Scenario: Restricted content

- **WHEN** the panel's HTML is generated
- **THEN** it has a content security policy that allows scripts only with the nonce and only from the extension's own files

#### Scenario: Close

- **WHEN** the panel is closed
- **THEN** its state subscription ends

### Requirement: Open the web page

The command `Variant: Open Variants in Browser` SHALL open the URL of the running UI server of the project, with its token, in the external browser. When no server runs, it SHALL start none; it SHALL show a message that gives the command `variant ui --detach` and offers a button that copies it.

#### Scenario: Server running

- **WHEN** the UI server is alive and the command runs
- **THEN** the external browser opens its URL with the token

#### Scenario: No server

- **WHEN** no UI server runs and the command runs
- **THEN** no browser opens and a message names `variant ui --detach` with a copy button

#### Scenario: Stopping from the view

- **WHEN** a person presses stop on the `variant-ui` row in the panel
- **THEN** the server stops and the row disappears
