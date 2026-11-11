## ADDED Requirements

### Requirement: Active file selects its variant

The Explorer **Variant Worktrees** tree and the activity-bar **Variant Worktrees** tree SHALL select the variant row whose directory contains the active text editor's file. The directory of `main` SHALL be the main checkout. The directory of every other variant row SHALL be that variant's worktree. A file matches a directory when its path is that directory or a path inside it, and a directory that is only a string prefix of a sibling path SHALL NOT match. When more than one directory matches, the longest directory SHALL win. The selection SHALL run when the active text editor changes, when the editor window gains focus, when the trees are created while a text editor is already active, and when the row list changes while that file stays active. The selection SHALL highlight that row and SHALL NOT move keyboard focus. It SHALL NOT focus the Explorer section or the activity-bar container. A tree that is not visible SHALL NOT be made visible for this selection, and a collapsed Explorer section SHALL NOT be expanded for it. When such a tree becomes visible, it SHALL select the row the active file matches, still without moving keyboard focus. The UI server item and the Database unreachable row SHALL NOT be selected because of a file path. An active editor that is not a file, and a file that matches no variant directory, SHALL leave the current selection unchanged. A cursor move inside the same file SHALL NOT change the selection. Focus leaving the text editor without another file becoming active SHALL NOT change the selection. A selection the person makes by hand SHALL remain until one of the runs above selects a row.

#### Scenario: File in a worktree

- **WHEN** the active editor's file is `/work/_v-demo/src/a.ts` and `demo`'s worktree is `/work/_v-demo`
- **THEN** each visible Variant Worktrees tree selects the `demo` row
- **AND** the editor keeps keyboard focus

#### Scenario: File in the main checkout

- **WHEN** the active editor's file is `/work/app/src/a.ts` and the main checkout is `/work/app`
- **THEN** each visible Variant Worktrees tree selects the `main` row
- **AND** the editor keeps keyboard focus

#### Scenario: Longer worktree wins

- **WHEN** the main checkout is `/work`, `demo`'s worktree is `/work/_v-demo`, and the active file is `/work/_v-demo/src/a.ts`
- **THEN** each visible tree selects `demo`
- **AND** it does not select `main`

#### Scenario: Sibling path is not the worktree

- **WHEN** `demo`'s worktree is `/work/_v-demo`, the main checkout is `/work/app`, and the active file is `/work/_v-demo-extra/a.ts`
- **THEN** the trees do not select `demo`

#### Scenario: Active editor changes

- **WHEN** the active editor changes from a file in the main checkout to `/work/_v-demo/src/a.ts`
- **THEN** each visible tree selects `demo`

#### Scenario: Window gains focus

- **WHEN** the editor window gains focus and the active file is `/work/_v-demo/src/a.ts`
- **THEN** each visible tree selects `demo`
- **AND** the editor keeps keyboard focus

#### Scenario: Already active when the trees exist

- **WHEN** the trees are created and the active file is already `/work/_v-demo/src/a.ts`
- **THEN** each visible tree selects `demo` without waiting for another focus change
- **AND** the editor keeps keyboard focus

#### Scenario: Row appears while the file stays active

- **WHEN** the active file is `/work/_v-demo/src/a.ts` and the `demo` row is absent, then that row is listed
- **THEN** each visible tree selects `demo`

#### Scenario: Hidden tree stays hidden

- **WHEN** the activity-bar tree is not visible and the active file is `/work/_v-demo/src/a.ts`
- **THEN** the activity-bar container is not focused and that tree is not shown
- **AND** when that tree becomes visible it selects `demo` without taking keyboard focus

#### Scenario: Collapsed section stays collapsed

- **WHEN** the Explorer section is collapsed and the active file is `/work/_v-demo/src/a.ts`
- **THEN** the section stays collapsed and is not focused

#### Scenario: Startup select does not take focus

- **WHEN** startup creates the trees, the Explorer section expands because adoption is `active`, and the active file is `/work/_v-demo/src/a.ts`
- **THEN** the visible Explorer tree selects `demo`
- **AND** the editor keeps focus
- **AND** the activity-bar container is not focused

#### Scenario: File outside every variant

- **WHEN** `demo` is selected and the active editor changes to `/other/notes.txt`, which is in no variant directory
- **THEN** `demo` stays selected

#### Scenario: Editor is not a file

- **WHEN** `demo` is selected and the active editor is not a file
- **THEN** `demo` stays selected

#### Scenario: Cursor moves in the same file

- **WHEN** `demo` is selected for `/work/_v-demo/src/a.ts` and the cursor moves inside that file
- **THEN** `demo` stays selected
- **AND** neither tree takes keyboard focus

#### Scenario: Focus leaves the text editor

- **WHEN** `demo` is selected and focus moves to the terminal without another file becoming active
- **THEN** `demo` stays selected

#### Scenario: Hand selection holds

- **WHEN** the trees have selected `demo` for the active file and the person selects `alpha` without changing that file
- **THEN** `alpha` stays selected
- **AND** when the active editor then changes to a file in `/work/_v-demo`, each visible tree selects `demo`

#### Scenario: UI server is not the file's row

- **WHEN** the UI server item is shown and the active file is in the main checkout
- **THEN** each visible tree selects `main`
- **AND** it does not select the UI server item
