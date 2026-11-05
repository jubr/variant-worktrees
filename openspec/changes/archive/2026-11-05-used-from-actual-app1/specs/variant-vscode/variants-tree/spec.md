## MODIFIED Requirements

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
