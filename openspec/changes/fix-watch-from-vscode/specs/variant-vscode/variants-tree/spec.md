## MODIFIED Requirements

### Requirement: Inline actions

Each item SHALL carry inline actions: play when the state is `down` or `up`, stop when it is `watching` or `up`, and implode for every item except `main`. The play control SHALL use the play icon and its tooltip SHALL be `variant watch`; the extension log SHALL name that activity `watch`. Play SHALL start a detached watch, stop SHALL bring the variant down, and implode SHALL first ask for confirmation in a modal dialog that names the variant and calls `implode` only when the person accepts. Play, stop, and implode SHALL run with the item's slug and with the item's directory as the working directory: the variant's worktree, or the main checkout when the item is `main`. The panel's watch, down, and implode SHALL use that same slug and directory. When the workspace folder is the variant root, these actions SHALL NOT use that folder as the working directory. The implode control SHALL be the rightmost inline action and SHALL be offered whether or not implode would succeed. Its icon SHALL be a trash icon in the foreground colour when `implodeClean` is not false (dark on a light theme, light on a dark theme) and red when `implodeClean` is false, and that red SHALL stay readable on white and on a dark background. The context menu SHALL add show output (opens the record's `log` file in an editor, enabled when it has one), open URL (when the record has one), open the panel and open the web page. A failing action SHALL show its error message as an error notification and record that failure, with the message, in the extension log. Every action SHALL be recorded in that log when it starts and when it finishes, with the slug it applies to, and the lines the action itself reports SHALL be recorded there too. A cancelled implode SHALL be recorded as cancelled and SHALL NOT be recorded as finished. While an action runs, the item SHALL show a progress icon and offer no inline action.

#### Scenario: Play

- **WHEN** a person presses play on the `demo` item in state `down`
- **THEN** a detached watch of `demo` starts and its item changes to `watching` without a manual refresh

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

#### Scenario: Play tooltip

- **WHEN** the play command is contributed
- **THEN** its title is `variant watch` and its icon is the play icon

#### Scenario: Clean implode icon

- **WHEN** `demo` has `implodeClean` true
- **THEN** its implode action uses the foreground trash icon and its tooltip says implode would succeed

#### Scenario: Dirty implode icon

- **WHEN** `demo` has `implodeClean` false
- **THEN** its implode action uses the red trash icon and its tooltip says implode would fail

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

- **WHEN** a person presses implode on `demo` and cancels the modal
- **THEN** the extension log records that implode of `demo` was cancelled

#### Scenario: Show output

- **WHEN** a person chooses show output on an item whose record has a `log`
- **THEN** that file opens in an editor
