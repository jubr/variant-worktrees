## MODIFIED Requirements

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
