# variant-vscode/variants-tree Specification

## Purpose

The Variants view in the Explorer sidebar: a native tree that lists variants with their state and offers play, stop and implode inline.

## Requirements

### Requirement: Variants view in the Explorer

The extension SHALL contribute a view titled `Variant Worktrees` to the Explorer container. The contribution SHALL NOT start the section expanded. The section SHALL remain available with a workspace folder open so a person can expand it. On startup, the extension SHALL call `getVariantsAdoption` for the first workspace folder. It SHALL expand that section and then return focus to the editor when the result is `active` or `detected` and `variant.autoExpand` is not `false`. `variant.autoExpand` defaults to expanding in those two cases. When the result is `none`, startup SHALL NOT expand the section, including when `variant.autoExpand` is `true`. The extension SHALL NOT collapse a section the person has expanded. It SHALL list every variant record of the project of the first workspace folder and SHALL always include a row titled `main`. When the library returns no `main` record, that row SHALL still appear, in state `down`, and SHALL NOT be implodable. The `main` row SHALL be the first variant row, after the UI server item when that item exists, and `variant.sort` SHALL NOT move it. Each other row SHALL use its slug as the label. A row SHALL show a state icon and, as description, the uptime when the record has one. The tooltip SHALL name the state in words, the mode, the URL, the worktree, and whether implode would succeed. The state SHALL follow the rules of `variant-ui/variants-view`: `watching`, `up`, or `down`. `down` SHALL use a hollow dot, `watching` SHALL use a filled green dot, and `up` SHALL use an icon of a different shape. The tooltip SHALL still name the state, so the green fill is not the only signal. With no config file the view SHALL show an introduction that variants are not initialized in this workspace, listing no variant rows, and that introduction SHALL include a button labelled `Onboard` that runs `variant.onboardingInit`.

#### Scenario: Default presentation

- **WHEN** a workspace with a `variants.yaml` is opened for the first time and `variant.autoExpand` is not `false`
- **THEN** the Variant Worktrees section is present in the Explorer and expanded

#### Scenario: Expanded again on startup

- **WHEN** the editor starts with the section collapsed, a `variants.yaml` is found, and `variant.autoExpand` is not `false`
- **THEN** the section is expanded and the editor keeps focus

#### Scenario: Auto-expand turned off

- **WHEN** the editor starts with `variant.autoExpand` set to `false`
- **THEN** the extension leaves the section as it was

#### Scenario: Detected adoption expands

- **WHEN** no config file is found, adoption is `detected`, and `variant.autoExpand` is not `false`
- **THEN** the section is expanded and the editor keeps focus

#### Scenario: No adoption does not auto-expand

- **WHEN** adoption is `none` and `variant.autoExpand` is `true`
- **THEN** startup does not expand the section

#### Scenario: Three states, three icons

- **WHEN** the project has a watching, an up, and a down variant
- **THEN** the watching row's dot is filled green, the down row's dot is hollow, the up row uses a different icon, and their tooltips name `watching`, `up`, and `down`

#### Scenario: Uptime in description

- **WHEN** a record has `uptimeSeconds: 3700`
- **THEN** its item description is `1h 1m`

#### Scenario: No configuration

- **WHEN** no `variants.yaml` or `variants.yml` is found for the workspace folder
- **THEN** the view shows an introduction that variants are not initialized, a button `Onboard`, and no variant rows

#### Scenario: Onboard opens the dialog

- **WHEN** a person presses `Onboard` in that introduction
- **THEN** the initialization dialog of `variant.onboardingInit` shows in the section

#### Scenario: Main is always first

- **WHEN** the records are `zeta`, `main`, and `alpha` and `variant.sort` is `name-desc`
- **THEN** the variant rows are `main`, `zeta`, `alpha`

#### Scenario: Main with no state file

- **WHEN** a config file is found and the library returns only `demo`
- **THEN** the rows are `main` then `demo`, and `main` is `down` and not implodable

#### Scenario: No folder

- **WHEN** no workspace folder is open
- **THEN** the view is not shown

### Requirement: Inline actions

Each variant row's run control SHALL be an inline action of the native tree, and so SHALL its implode control when the row is not `main`. The host shows an inline action while the pointer is over the row or the row is selected. The run control SHALL be the play icon with tooltip `variant watch` when the state is `down`, and SHALL start a detached watch. The extension log SHALL name that activity `watch`. The run control SHALL be a square stop icon when the state is `watching` or `up`, and SHALL bring the variant down. Exactly one of those two controls SHALL be shown. Play, stop, and implode SHALL run with the row's slug and with the row's directory as the working directory: the variant's worktree, or the main checkout when the row is `main`. The panel's watch, down, and implode SHALL use that same slug and directory. When the workspace folder is the variant root, these actions SHALL NOT use that folder as the working directory. The implode control SHALL be an explosion icon and SHALL be the rightmost of these inline controls. The `main` row SHALL show no implode control. Every other row SHALL show the explosion. It SHALL be enabled when `implodeClean` is not false. When `implodeClean` is false, the control SHALL be a muted explosion whose tooltip is its title, because a disabled inline command is omitted. The enabled tooltip SHALL say implode would succeed. The muted tooltip SHALL say implode would fail. An enabled implode SHALL first ask for confirmation in a modal dialog that names the variant and SHALL call `implode` only when the person accepts. A muted implode SHALL NOT open that dialog and SHALL NOT call `implode`. The context menu SHALL add show output (opens the record's `log` file in an editor, enabled when it has one), open URL (when the record has one), open the panel, and open the web page. A failing action SHALL show its error message as an error notification and record that failure, with the message, in the extension log. Every action SHALL be recorded in that log when it starts and when it finishes, with the slug it applies to, and the lines the action itself reports SHALL be recorded there too. A cancelled implode SHALL be recorded as cancelled and SHALL NOT be recorded as finished. While an action runs, the row SHALL show a progress indicator and SHALL offer no inline action.

#### Scenario: Play

- **WHEN** a person presses play on the `demo` row in state `down`
- **THEN** a detached watch of `demo` starts and its row changes to `watching` without a manual refresh

#### Scenario: Play from the variant root

- **WHEN** the workspace folder is `/work`, `/work` is the variant root, and a person presses play on `foo` whose worktree is `/work/_v-foo`
- **THEN** watch runs for slug `foo` with working directory `/work/_v-foo`
- **AND** it does not run with working directory `/work`

#### Scenario: Stop from the variant root

- **WHEN** a person presses stop on that `foo`
- **THEN** down runs for slug `foo` with working directory `/work/_v-foo`

#### Scenario: Implode from the variant root

- **WHEN** a person accepts implode on that `foo`
- **THEN** implode runs for slug `foo` with working directory `/work/_v-foo`

#### Scenario: Play on main

- **WHEN** a person presses play on `main` and the main checkout is `/work/app`
- **THEN** watch runs for slug `main` with working directory `/work/app`

#### Scenario: Stop

- **WHEN** a person presses the square stop on a watching `demo`
- **THEN** its processes stop and the row changes to `down`

#### Scenario: Up shows stop

- **WHEN** a row is `up`
- **THEN** it shows the square stop and does not show play

#### Scenario: Implode confirmed

- **WHEN** a person presses the explosion control on a clean `demo` and accepts the modal
- **THEN** `demo` is imploded and its row disappears

#### Scenario: Implode cancelled

- **WHEN** a person presses the explosion control on a clean `demo` and cancels the modal
- **THEN** nothing is imploded

#### Scenario: Main has no implode

- **WHEN** the `main` row is shown
- **THEN** it has no explosion control

#### Scenario: Play tooltip

- **WHEN** the play control is shown
- **THEN** its title is `variant watch` and its icon is the play icon

#### Scenario: Clean implode icon

- **WHEN** `demo` has `implodeClean` true
- **THEN** its explosion control is enabled, not muted, and its tooltip says implode would succeed

#### Scenario: Dirty implode icon

- **WHEN** `demo` has `implodeClean` false
- **THEN** its explosion control is the muted explosion, and its tooltip says implode would fail

#### Scenario: Error reported

- **WHEN** implode fails with `Variant demo is not merged into main`
- **THEN** an error notification shows that message
- **AND** the extension log records that implode of `demo` failed with that message

#### Scenario: Action recorded

- **WHEN** a person presses play on `demo` and the watch starts
- **THEN** the extension log records that watch of `demo` started and that it finished

#### Scenario: Reported lines recorded

- **WHEN** a watch of `demo` reports `nothing was started`
- **THEN** the extension log records that line

#### Scenario: Implode cancelled is recorded

- **WHEN** a person presses the explosion control on `demo` and cancels the modal
- **THEN** the extension log records that implode of `demo` was cancelled

#### Scenario: Show output

- **WHEN** a person chooses show output on a row whose record has a `log`
- **THEN** that file opens in an editor

### Requirement: Sort order

The view title SHALL show a Sort menu immediately to the left of Open Variants Panel. The menu SHALL offer `name-asc`, `name-desc`, `created-asc`, `created-desc`, `changed-asc`, and `changed-desc`, labelled `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, and `Changed (new→old)`. The Sort control's tooltip SHALL name the selected label, for example `Sort: Created (new→old)`. The menu SHALL show a check on the selected item and on no other item. Choosing one SHALL store it in the setting `variant.sort`, which defaults to `name-asc`, and the same setting changed from the Settings editor SHALL reorder the view. `name` orders by slug. `created` orders by `createdMs` and `changed` by `changedMs`. A missing time SHALL sort as older than every known time. Ascending SHALL be smaller first. An equal key SHALL break the tie by slug ascending. This order SHALL apply to every variant except `main`, which stays first. The UI server item SHALL stay above the variants.

#### Scenario: Default order

- **WHEN** `variant.sort` is unset and the variants are `zeta`, `main`, and `alpha`
- **THEN** the rows are `main`, `alpha`, `zeta`

#### Scenario: Menu placement

- **WHEN** the view title menu is read
- **THEN** the Sort menu is in the navigation group ahead of Open Variants Panel

#### Scenario: Changed descending

- **WHEN** `variant.sort` is `changed-desc` and `old` was modified before `new`
- **THEN** `new` is listed before `old`, and `main` is listed before both when it is present

#### Scenario: Setting from the menu

- **WHEN** a person chooses `Created (old→new)` in the Sort menu
- **THEN** `variant.sort` becomes `created-asc` and the rows reorder

#### Scenario: Tooltip names the selection

- **WHEN** `variant.sort` is `created-desc`
- **THEN** the Sort control's tooltip is `Sort: Created (new→old)`

#### Scenario: Check on the selected item

- **WHEN** the Sort menu is opened and `variant.sort` is `name-asc`
- **THEN** `Name (A→Z)` has a check before it and the other five labels do not

### Requirement: UI server item

When the `main` record has a `variant-ui` watch, the view SHALL show an item for it above the variants, labelled `UI server`, with the URL as description, an open-in-browser action and a stop action that stops that server.

#### Scenario: Server item

- **WHEN** the UI server runs at `http://ui.vw.localhost:62100`
- **THEN** the view shows a `UI server` item with that URL, and its stop action ends the server

#### Scenario: No server

- **WHEN** no `variant-ui` watch is recorded
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

### Requirement: Create variant

The view title SHALL show a command titled `Create variant`, with the add icon, in the navigation group immediately to the left of Sort. Activating it SHALL open an input box created with `createInputBox` whose title is `Create variant`. Accepting a slug SHALL run `create` with that slug. When `create` finishes, the section SHALL reload its rows and SHALL list the new variant. An empty value SHALL be rejected in the input and SHALL NOT run `create`. Dismissing the input SHALL NOT run `create` and SHALL leave the list unchanged.

#### Scenario: Button placement

- **WHEN** the view title menu is read
- **THEN** Create variant is in the navigation group immediately ahead of Sort

#### Scenario: Accept creates and reloads

- **WHEN** a person accepts `demo` in the Create variant input
- **THEN** `create` runs for `demo` and the section lists `demo` without a manual refresh

#### Scenario: Empty value

- **WHEN** a person accepts an empty value in the Create variant input
- **THEN** the input rejects it and `create` does not run

#### Scenario: Dismiss

- **WHEN** a person dismisses the Create variant input
- **THEN** `create` does not run and the list is unchanged
