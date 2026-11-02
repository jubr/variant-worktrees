## Purpose

The Variants view in the Explorer sidebar: a native tree that lists variants with their state and offers play, stop and implode inline.

## ADDED Requirements

### Requirement: Variants view in the Explorer

The extension SHALL contribute a view titled `Variant Worktrees` to the Explorer container that is visible and expanded by default and can be collapsed with its chevron like any Explorer section. On startup, unless `variant.autoExpand` is `false`, the extension SHALL expand that section and then return focus to the editor. `variant.autoExpand` defaults to expanding. It SHALL list every variant record of the project of the first workspace folder, `main` first, each as a tree item with its slug as the label, a state icon, and as description the uptime when the record has one. The tooltip SHALL name the state in words, the mode, the URL and the worktree. The state SHALL follow the rules of `variant-ui/variants-view`: `watching`, `up` or `down`, with three different icons. With no `variants.yaml` the view SHALL show a welcome message saying so, and with no variants a welcome message naming `variant create`.

#### Scenario: Default presentation

- **WHEN** a workspace with a `variants.yaml` is opened for the first time
- **THEN** the Variant Worktrees section is present in the Explorer and expanded

#### Scenario: Expanded again on startup

- **WHEN** the editor starts with the section collapsed and `variant.autoExpand` is not `false`
- **THEN** the section is expanded and the editor keeps focus

#### Scenario: Auto-expand turned off

- **WHEN** the editor starts with `variant.autoExpand` set to `false`
- **THEN** the extension leaves the section as it was

#### Scenario: Three states, three icons

- **WHEN** the project has a watching, an up and a down variant
- **THEN** their items use three different icons and their tooltips name `watching`, `up` and `down`

#### Scenario: Uptime in description

- **WHEN** a record has `uptimeSeconds: 3700`
- **THEN** its item description is `1h 1m`

#### Scenario: No configuration

- **WHEN** no `variants.yaml` is found for the workspace folder
- **THEN** the view shows a welcome message that no `variants.yaml` was found and lists nothing

#### Scenario: No folder

- **WHEN** no workspace folder is open
- **THEN** the view is not shown

### Requirement: Inline actions

Each item SHALL carry inline actions: play when the state is `down` or `up`, stop when it is `watching` or `up`, and implode for every item except `main`. Play SHALL start a detached watch, stop SHALL bring the variant down, and implode SHALL first ask for confirmation in a modal dialog that names the variant and calls `implode` only when the person accepts. The context menu SHALL add show output (opens the record's `log` file in an editor, enabled when it has one), open URL (when the record has one), open the panel and open the web page. A failing action SHALL show its error message as an error notification and record that failure, with the message, in the extension log. Every action SHALL be recorded in that log when it starts and when it finishes, with the slug it applies to, and the lines the action itself reports SHALL be recorded there too. A cancelled implode SHALL be recorded as cancelled and SHALL NOT be recorded as finished. While an action runs, the item SHALL show a progress icon and offer no inline action.

#### Scenario: Play

- **WHEN** a person presses play on the `demo` item in state `down`
- **THEN** a detached watch of `demo` starts and its item changes to `watching` without a manual refresh

#### Scenario: Stop

- **WHEN** a person presses stop on a watching `demo`
- **THEN** its processes stop and the item changes to `down`

#### Scenario: Implode confirmed

- **WHEN** a person presses implode on `demo` and accepts the modal
- **THEN** `demo` is imploded and its item disappears

#### Scenario: Implode cancelled

- **WHEN** a person presses implode on `demo` and cancels the modal
- **THEN** nothing is imploded

#### Scenario: Main has no implode

- **WHEN** the `main` item is shown
- **THEN** it has no implode action

#### Scenario: Error reported

- **WHEN** implode fails with `Variant demo is not merged into main`
- **THEN** an error notification shows that message
- **AND** the extension log records that implode of `demo` failed with that message

#### Scenario: Action recorded

- **WHEN** a person presses play on `demo` and the watch starts
- **THEN** the extension log records that play of `demo` started and that it finished

#### Scenario: Reported lines recorded

- **WHEN** a watch of `demo` reports `nothing was started`
- **THEN** the extension log records that line

#### Scenario: Implode cancelled is recorded

- **WHEN** a person presses implode on `demo` and cancels the modal
- **THEN** the extension log records that implode of `demo` was cancelled

#### Scenario: Show output

- **WHEN** a person chooses show output on an item whose record has a `log`
- **THEN** that file opens in an editor

### Requirement: UI server item

When the `main` record has a `variant-ui` instance, the view SHALL show an item for it above the variants, labelled `UI server`, with the URL as description, an open-in-browser action and a stop action that stops that server.

#### Scenario: Server item

- **WHEN** the UI server runs at `http://ui.vw.localhost:62100`
- **THEN** the view shows a `UI server` item with that URL, and its stop action ends the server

#### Scenario: No server

- **WHEN** no `variant-ui` instance is recorded
- **THEN** the view shows no `UI server` item

### Requirement: Live updates

The view SHALL update from the state subscription of the library without polling of its own, so a change made by the CLI, an agent over MCP or another editor window shows in the view within five seconds.

#### Scenario: Started elsewhere

- **WHEN** `variant watch` runs in a terminal for `demo` while the view is open
- **THEN** the `demo` item changes to `watching` within five seconds

### Requirement: Host requirement

The extension SHALL declare that it needs VS Code 1.101 or a host built on a Node.js runtime of 22.13 or newer, because the library reads sqlite databases through `node:sqlite`. A host older than that SHALL NOT activate the extension.

#### Scenario: Declared engine

- **WHEN** the extension manifest is read
- **THEN** `engines.vscode` is `^1.101.0` and `@types/vscode` is not newer than that
