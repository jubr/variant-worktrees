## ADDED Requirements

### Requirement: Variants tree on the activity bar

The extension SHALL contribute a view container titled `Variant Worktrees` to the activity bar. Its icon SHALL be `variant-worktrees-view-icon.svg`, and the packaged extension SHALL contain that file. That container SHALL hold one tree view, also titled `Variant Worktrees`. The view SHALL be available whenever a workspace folder is open, including while the Explorer section shows the onboarding dialog, and SHALL NOT be shown when no workspace folder is open. It SHALL list the same rows, in the same order, with the same icons, descriptions, and tooltips as the Explorer **Variant Worktrees** tree. It SHALL show the same welcome content, the same title actions, and the same item actions. A change to the list or to a row SHALL appear in both views. An action started from either view SHALL run once and update both. Pressing `Onboard` in the activity-bar view SHALL open the initialization dialog in the Explorer section and SHALL NOT replace the activity-bar view with that dialog. Startup SHALL NOT focus this activity-bar container, including when it expands the Explorer section. The extension SHALL NOT contribute a Variant Worktrees container to the panel area that holds the terminal. The webview opened by **Variant: Open Variants Panel** SHALL remain a separate surface.

#### Scenario: Activity bar container beside the Explorer

- **WHEN** a workspace folder is open
- **THEN** the activity bar has a view container titled `Variant Worktrees` whose icon is `variant-worktrees-view-icon.svg` and whose tree is titled `Variant Worktrees`
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
