## ADDED Requirements

### Requirement: Variants tree in the panel

The extension SHALL contribute a view container titled `Variant Worktrees` to the editor's panel, the area that holds the terminal. That container SHALL hold one tree view, also titled `Variant Worktrees`. The view SHALL be available whenever a workspace folder is open, including while the Explorer section shows the onboarding dialog, and SHALL NOT be shown when no workspace folder is open. It SHALL list the same rows, in the same order, with the same icons, descriptions, and tooltips as the Explorer **Variant Worktrees** tree. It SHALL show the same welcome content, the same title actions, and the same item actions. A change to the list or to a row SHALL appear in both views. An action started from either view SHALL run once and update both. Pressing `Onboard` in the panel view SHALL open the initialization dialog in the Explorer section and SHALL NOT replace the panel view with that dialog. Startup SHALL NOT reveal or focus this panel view, including when it expands the Explorer section. The webview opened by **Variant: Open Variants Panel** SHALL remain a separate surface.

#### Scenario: Panel container beside the Explorer

- **WHEN** a workspace folder is open
- **THEN** the panel has a view container titled `Variant Worktrees` whose tree is titled `Variant Worktrees`
- **AND** the Explorer still has its Variant Worktrees section

#### Scenario: Same rows

- **WHEN** the project lists `main` and `demo`
- **THEN** the panel view lists `main` then `demo`, the same order as the Explorer section

#### Scenario: Action from the panel view

- **WHEN** a person presses play on `demo` in the panel view while `demo` is `down`
- **THEN** one detached watch of `demo` starts
- **AND** both the panel view and the Explorer section show `demo` as `watching`

#### Scenario: Same welcome

- **WHEN** no `variants.yaml` or `variants.yml` is found for the workspace folder
- **THEN** the panel view shows the same introduction and `Onboard` button as the Explorer section, and no variant rows

#### Scenario: Onboard from the panel view

- **WHEN** a person presses `Onboard` in the panel view
- **THEN** the initialization dialog shows in the Explorer section
- **AND** the panel view does not show that dialog

#### Scenario: Onboarding leaves the panel view

- **WHEN** the Explorer section is showing the onboarding dialog
- **THEN** the panel view still shows the variants tree or its introduction

#### Scenario: Startup does not open the panel

- **WHEN** startup expands the Explorer section because adoption is `active` and `variant.autoExpand` is not `false`
- **THEN** the editor keeps focus
- **AND** the panel view is not revealed

#### Scenario: No folder

- **WHEN** no workspace folder is open
- **THEN** the panel view is not shown
