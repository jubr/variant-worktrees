# variant-vscode/variants-tree Specification

## Purpose

The Variants view in the Explorer sidebar: a native tree that lists variants with their state and offers play, stop and implode inline.

## Requirements

### Requirement: Variants view in the Explorer

The extension SHALL contribute a view titled `Variant Worktrees` to the Explorer container. The contribution SHALL NOT start the section expanded. The section SHALL remain available with a workspace folder open so a person can expand it. On startup, the extension SHALL call `getVariantsAdoption` for the first workspace folder. It SHALL expand that section without focusing it and without moving focus when the result is `active` or `detected` and `variant.autoExpand` is not `false`. `variant.autoExpand` defaults to expanding in those two cases. When the result is `none`, startup SHALL NOT expand the section, including when `variant.autoExpand` is `true`. The extension SHALL NOT collapse a section the person has expanded. It SHALL list every variant record of the project of the first workspace folder and SHALL always include a row titled `main`. When the library returns no `main` record, that row SHALL still appear, in state `down`, and SHALL NOT be implodable. The `main` row SHALL be the first variant row, after the UI server item when that item exists, and `variant.sort` SHALL NOT move it. Each other row SHALL use its slug as the label. A row SHALL show a state icon and, as description, the uptime when the record has one. The tooltip SHALL name the state in words, the mode, the URL, the worktree, and whether implode would succeed. The state SHALL follow the rules of `variant-ui/variants-view`: `watching`, `up`, or `down`. `down` SHALL use a hollow dot, `watching` SHALL use a filled green dot, and `up` SHALL use an icon of a different shape. The tooltip SHALL still name the state, so the green fill is not the only signal. With no config file the view SHALL show an introduction that variants are not initialized in this workspace, listing no variant rows, and that introduction SHALL include a button labelled `Onboard` that runs `variant.onboardingInit`.

#### Scenario: Default presentation

- **WHEN** a workspace with a `variants.yaml` is opened for the first time and `variant.autoExpand` is not `false`
- **THEN** the Variant Worktrees section is present in the Explorer and expanded
- **AND** the section is not focused and focus stays where it was

#### Scenario: Expanded again on startup

- **WHEN** the editor starts with the section collapsed, a `variants.yaml` is found, and `variant.autoExpand` is not `false`
- **THEN** the section is expanded
- **AND** the section is not focused and the editor keeps focus

#### Scenario: Auto-expand turned off

- **WHEN** the editor starts with `variant.autoExpand` set to `false`
- **THEN** the extension leaves the section as it was

#### Scenario: Detected adoption expands

- **WHEN** no config file is found, adoption is `detected`, and `variant.autoExpand` is not `false`
- **THEN** the section is expanded
- **AND** the section is not focused and the editor keeps focus

#### Scenario: No adoption does not auto-expand

- **WHEN** adoption is `none` and `variant.autoExpand` is `true`
- **THEN** startup does not expand the section
- **AND** startup does not focus the section

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

Each variant row's run control SHALL be an inline action of the native tree, and so SHALL its implode control when the row is not `main`. The host shows an inline action while the pointer is over the row or the row is selected. The run control SHALL be the play icon with tooltip `variant watch` when the state is `down`, and SHALL start a detached watch. The extension log SHALL name that activity `watch`. The run control SHALL be a square stop icon when the state is `watching` or `up`, and SHALL bring the variant down. Exactly one of those two controls SHALL be shown. When the record has a URL, the row SHALL show an Open url control immediately left of that run control, with the same external-link icon as the section header's Open Variants in Browser. A row with no URL SHALL show no Open url control. Activating Open url without Alt SHALL open that URL in the external browser and SHALL NOT open an editor tab. The tooltip SHALL be `Open url in external browser`. While Alt is held, the tooltip SHALL be `Open url in Cursor browser`, and activating Open url SHALL open that URL in a Cursor browser tab and SHALL NOT open the external browser. The button tooltip SHALL NOT depend on which row is under the pointer. The row tooltip SHALL still name the URL. Play, stop, and implode SHALL run with the row's slug and with the row's directory as the working directory: the variant's worktree, or the main checkout when the row is `main`. The panel's watch, down, and implode SHALL use that same slug and directory. When the workspace folder is the variant root, these actions SHALL NOT use that folder as the working directory. The implode control SHALL be an explosion icon and SHALL be the rightmost of these inline controls. The `main` row SHALL show no implode control. Every other row SHALL show the explosion. It SHALL be enabled when `implodeClean` is not false. When `implodeClean` is false, the control SHALL be a muted explosion whose tooltip is its title, because a disabled inline command is omitted. The enabled tooltip SHALL say implode would succeed. The muted tooltip SHALL say implode would fail. An enabled implode SHALL first ask for confirmation in a modal dialog that names the variant and SHALL call `implode` only when the person accepts. A muted implode SHALL NOT open that dialog. Activating it SHALL write the implode report for that slug, the same text `variant implode` prints including its ANSI color, to the extension output, which shows those colors, and SHALL then show a non-modal notification whose text is ``Clean implode failed, do you want to `--force`?`` and whose buttons are `Cancel` and `Force`. Producing that report SHALL NOT remove the worktree and SHALL NOT call `implode`. Choosing `Cancel` or dismissing the notification SHALL NOT call `implode`. Choosing `Force` SHALL call `implode` with force and SHALL NOT open the clean-implode modal. The context menu SHALL add show output (opens the record's `log` file in an editor, enabled when it has one), open URL (when the record has one), open the panel, and open the web page. A failing action SHALL show its error message as a non-modal error notification and record that failure, with the message, in the extension log. A failure of watch, down, or implode, including an implode started with force, SHALL show that error message in that notification. Every action SHALL be recorded in that log when it starts and when it finishes, with the slug it applies to, and the lines the action itself reports SHALL be recorded there too. A cancelled implode, including `Cancel` or a dismissal of the force notification, SHALL be recorded as cancelled and SHALL NOT be recorded as finished. While an action runs, the row SHALL show a progress indicator and SHALL offer no inline action. After a watch this view started has returned, and until that watch is confirmed up, the row SHALL show a loading icon (`loading~spin`) instead of the watching icon. Confirmation SHALL be asynchronous and SHALL NOT block the tree. The watch is up when the pid recorded for the watch that owns the row URL is alive and an HTTP GET of that URL joined with the watch's `ready` path returns status 200. `ready` starts with `/` and the join keeps one slash, so `http://host:port` and `/index.html` become `http://host:port/index.html`. The first time a watch this view started reaches that result, the extension SHALL open that URL in the external browser once, and SHALL NOT open it again until the watch has been down and this view has started it again. A watch that already returns 200 when the view loads SHALL NOT be opened. When the pid is gone before that GET returns 200, the row SHALL leave the loading icon and show the down or stale state it already shows for a dead process. A row with no URL, and a watch with no `ready` path, SHALL keep the existing pid-alive state, SHALL NOT be fetched, and SHALL NOT be opened by this check. The extension SHALL NOT invent `/health`.

#### Scenario: Play

- **WHEN** a person presses play on the `demo` row in state `down`, that row's URL is `http://demo.vw.localhost:62100`, and the watch `ready` path is `/index.html`
- **THEN** a detached watch of `demo` starts with working directory of that row, the row shows the loading icon, and the tree still lists the other rows while `GET http://demo.vw.localhost:62100/index.html` has not returned

#### Scenario: Ready path confirms the watch

- **WHEN** that watch's pid is alive and `GET http://demo.vw.localhost:62100/index.html` returns 200
- **THEN** the row shows the watching icon and the external browser opens `http://demo.vw.localhost:62100` once

#### Scenario: Already up is not opened

- **WHEN** the view loads and `demo` already has a live pid and the GET of its URL joined with `ready` returns 200
- **THEN** the row shows the watching icon and the external browser is not opened

#### Scenario: Pid dies before ready

- **WHEN** the pid recorded for the watch dies before the GET of its URL joined with `ready` returns 200
- **THEN** the row leaves the loading icon and shows the down or stale state

#### Scenario: No url skips the check

- **WHEN** a watch this view started has no URL
- **THEN** the row is not opened by the check

#### Scenario: No ready path skips the check

- **WHEN** a watch this view started has a URL and no `ready` path
- **THEN** the row is not fetched, is not opened, and uses the existing pid-alive state

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

#### Scenario: Dirty implode offers force

- **WHEN** a person activates the muted explosion on `demo` whose worktree has an unstaged added line in `src/a.ts`
- **THEN** the extension output shows the implode report, the added hunk line is wrapped in `\033[32m` and `\033[0m`, and the worktree is unchanged
- **AND** a non-modal notification shows ``Clean implode failed, do you want to `--force`?`` with buttons `Cancel` and `Force`
- **AND** the clean-implode modal is not shown
- **AND** `implode` has not been called

#### Scenario: Force from the dirty explosion

- **WHEN** a person activates the muted explosion on `demo` and chooses `Force`
- **THEN** `implode` of `demo` runs with force
- **AND** the clean-implode modal is not shown

#### Scenario: Cancel the force notification

- **WHEN** a person activates the muted explosion on `demo` and chooses `Cancel`
- **THEN** nothing is imploded

#### Scenario: Dismiss the force notification

- **WHEN** a person activates the muted explosion on `demo` and dismisses the notification
- **THEN** nothing is imploded

#### Scenario: Open url left of play

- **WHEN** a `down` row has URL `http://demo.vw.localhost:62100`
- **THEN** Open url is the inline control immediately left of play

#### Scenario: Open url left of stop

- **WHEN** a `watching` row has a URL
- **THEN** Open url is the inline control immediately left of stop

#### Scenario: No url

- **WHEN** a row has no URL
- **THEN** it shows no Open url control

#### Scenario: Open url in the external browser

- **WHEN** a person activates Open url on a row whose URL is `http://demo.vw.localhost:62100` without Alt
- **THEN** the external browser opens that URL
- **AND** no Cursor browser tab opens

#### Scenario: Open url tooltip

- **WHEN** the person hovers Open url on that row
- **THEN** the tooltip is `Open url in external browser`

#### Scenario: Open url in a Cursor browser tab

- **WHEN** Alt is held and the person activates Open url on that row
- **THEN** a Cursor browser tab opens `http://demo.vw.localhost:62100`
- **AND** the external browser does not open

#### Scenario: Open url tooltip with Alt

- **WHEN** Alt is held while the person hovers Open url on that row
- **THEN** the tooltip is `Open url in Cursor browser`

#### Scenario: Error reported

- **WHEN** implode fails with `Variant demo is not merged into main`
- **THEN** a non-modal error notification shows that message
- **AND** the extension log records that implode of `demo` failed with that message

#### Scenario: Watch failure

- **WHEN** watch of `demo` fails with `mise failed`
- **THEN** a non-modal error notification shows `mise failed`

#### Scenario: Down failure

- **WHEN** down of `demo` fails with `no such variant`
- **THEN** a non-modal error notification shows `no such variant`

#### Scenario: Forced implode failure

- **WHEN** a forced implode of `demo` fails with `worktree is locked`
- **THEN** a non-modal error notification shows `worktree is locked`

#### Scenario: Action recorded

- **WHEN** a person presses play on `demo` and the watch starts
- **THEN** the extension log records that watch of `demo` started and that it finished

#### Scenario: Reported lines recorded

- **WHEN** a watch of `demo` reports `nothing was started`
- **THEN** the extension log records that line

#### Scenario: Implode cancelled is recorded

- **WHEN** a person presses the explosion control on a clean `demo` and cancels the modal
- **THEN** the extension log records that implode of `demo` was cancelled

#### Scenario: Force notification cancelled is recorded

- **WHEN** a person activates the muted explosion on `demo` and chooses `Cancel`
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

### Requirement: Variants tree on the activity bar

The extension SHALL contribute a view container titled `Variant Worktrees` to the activity bar. Its icon SHALL be `vw-mini-icon.svg`, and the packaged extension SHALL contain that file. That container SHALL hold one tree view, also titled `Variant Worktrees`. The view SHALL be available whenever a workspace folder is open, including while the Explorer section shows the onboarding dialog, and SHALL NOT be shown when no workspace folder is open. It SHALL list the same rows, in the same order, with the same icons, descriptions, and tooltips as the Explorer **Variant Worktrees** tree. It SHALL show the same welcome content, the same title actions, and the same item actions. A change to the list or to a row SHALL appear in both views. An action started from either view SHALL run once and update both. Pressing `Onboard` in the activity-bar view SHALL open the initialization dialog in the Explorer section and SHALL NOT replace the activity-bar view with that dialog. Startup SHALL NOT focus this activity-bar container, including when it expands the Explorer section. The extension SHALL NOT contribute a Variant Worktrees container to the panel area that holds the terminal. The webview opened by **Variant: Open Variants Panel** SHALL remain a separate surface.

#### Scenario: Activity bar container beside the Explorer

- **WHEN** a workspace folder is open
- **THEN** the activity bar has a view container titled `Variant Worktrees` whose icon is `vw-mini-icon.svg` and whose tree is titled `Variant Worktrees`
- **AND** the Explorer still has its Variant Worktrees section

#### Scenario: Same rows

- **WHEN** the project lists `main` and `demo`
- **THEN** the activity-bar view lists `main` then `demo`, the same order as the Explorer section

#### Scenario: Action from the activity bar view

- **WHEN** a person presses play on `demo` in the activity-bar view while `demo` is `down`
- **THEN** one detached watch of `demo` starts
- **AND** both the activity-bar view and the Explorer section show `demo` as `watching`

#### Scenario: Same welcome

- **WHEN** no `variants.yaml` or `variants.yml` is found for the workspace folder
- **THEN** the activity-bar view shows the same introduction and `Onboard` button as the Explorer section, and no variant rows

#### Scenario: Onboard from the activity bar view

- **WHEN** a person presses `Onboard` in the activity-bar view
- **THEN** the initialization dialog shows in the Explorer section
- **AND** the activity-bar view does not show that dialog

#### Scenario: Onboarding leaves the activity bar view

- **WHEN** the Explorer section is showing the onboarding dialog
- **THEN** the activity-bar view still shows the variants tree or its introduction

#### Scenario: Startup does not select the activity bar container

- **WHEN** startup expands the Explorer section because adoption is `active` and `variant.autoExpand` is not `false`
- **THEN** the editor keeps focus
- **AND** the activity-bar container is not focused

#### Scenario: No folder

- **WHEN** no workspace folder is open
- **THEN** the activity-bar view is not shown

### Requirement: Welcome when no variants exist

When `variant.noVariants` is set, the Explorer **Variant Worktrees** view and the activity-bar view SHALL show the welcome text `Variants are not initialized, but no variants created yet.` and a button labelled `Onboard` that runs `variant.create`. They SHALL list no variant rows. That button SHALL open the same Create variant input as the view title's Create variant command. It SHALL NOT run `variant.onboardingInit`.

#### Scenario: Empty welcome

- **WHEN** `variant.noVariants` is set
- **THEN** both views show `Variants are not initialized, but no variants created yet.`, a button `Onboard`, and no variant rows

#### Scenario: Onboard opens Create variant

- **WHEN** a person presses `Onboard` in that welcome
- **THEN** the Create variant input opens
- **AND** `variant.onboardingInit` does not run

### Requirement: Unreachable database in the trees

When the library reports that the configured database cannot be contacted, the Explorer **Variant Worktrees** tree and the activity-bar **Variant Worktrees** tree SHALL keep their variant rows, including `main`. They SHALL show a row above those variants whose label is `Database unreachable`, with a warning icon, a description that names the database and the host, and a tooltip that is the contact warning. The label, description, and tooltip SHALL NOT contain a SQL statement or `Failed query`. The row SHALL disappear when the database can be contacted again. A read that fails for another reason SHALL still be shown as it is today.

#### Scenario: Rows stay, warning leads

- **WHEN** variant `demo` has a state file and the configured database `app` at host `127.0.0.1` cannot be contacted
- **THEN** both trees list `Database unreachable` first, then the variant rows including `main` and `demo`
- **AND** the warning row's description contains `app` and `127.0.0.1`, and its tooltip does not contain `SELECT`

#### Scenario: Warning row leaves

- **WHEN** the database can be contacted again
- **THEN** neither tree shows `Database unreachable`

### Requirement: One warning notification

When the configured database becomes unreachable, the editor SHALL show one non-modal warning notification whose text is the contact warning. Further refreshes while it stays unreachable SHALL NOT show another. After contact returns, a later loss of contact SHALL show one notification again. The notification SHALL NOT contain a SQL statement.

#### Scenario: Once per outage

- **WHEN** the database cannot be contacted and the tree refreshes three times before contact returns
- **THEN** one warning notification is shown, and its text does not contain `SELECT`

#### Scenario: A new outage notifies again

- **WHEN** contact returns and is then lost again
- **THEN** a second warning notification is shown

### Requirement: Library logs on the Variant Worktrees channel

The extension SHALL write each library log event to the existing **Variant Worktrees** log channel at the same level: `trace` as trace, `debug` as debug, `info` as info, `warn` as warning, and `error` as error. It SHALL NOT open a second channel for those events.

#### Scenario: Contact warning reaches the channel

- **WHEN** the library emits the database contact warning
- **THEN** the **Variant Worktrees** log channel receives it as a warning
- **AND** no other log channel is created for it

### Requirement: Implode modal names the branch

The native implode confirmation SHALL name the variant and SHALL say that the database target, the worktree, and the branch are removed. Accepting it SHALL call `implode` without a branch choice, so the implode default applies.

#### Scenario: Modal names the branch

- **WHEN** a person presses the explosion control on a clean `demo`
- **THEN** the modal detail says the branch of `demo` is removed
