## Purpose

Reports whether the running editor registers Cursor-family commands whose ids look like chat rename or title operations, without invoking them.

## ADDED Requirements

### Requirement: Probe command is available

The extension SHALL contribute command `variant-vscode.probeCursorCommands` with title `Variant: Probe Cursor Chat Commands` and SHALL activate when that command runs.

#### Scenario: Command is registered

- **WHEN** the extension activates
- **THEN** command `variant-vscode.probeCursorCommands` is registered

#### Scenario: Palette title

- **WHEN** a user inspects the contributed command
- **THEN** its title is `Variant: Probe Cursor Chat Commands`

### Requirement: Probe considers every registered command

The probe SHALL read every command id registered in the current editor process, including commands that are hidden from the command palette.

#### Scenario: Hidden commands are eligible

- **WHEN** the user runs `variant-vscode.probeCursorCommands`
- **THEN** the probe requests the full registered command list, including internal commands

### Requirement: Match a chat family and a title verb

The probe SHALL report a command id only when that id contains, case-insensitively and as a substring, at least one of `cursor`, `composer`, `aichat`, or `agent`, and at least one of `rename`, `title`, or `label`.

#### Scenario: Composer rename command is reported

- **WHEN** the registered ids include `composer.renameChat`
- **THEN** the report includes `composer.renameChat`

#### Scenario: Mixed-case title command is reported

- **WHEN** the registered ids include `Cursor.SetTitle`
- **THEN** the report includes `Cursor.SetTitle`

#### Scenario: Agent label command is reported

- **WHEN** the registered ids include `agent.updateLabel`
- **THEN** the report includes `agent.updateLabel`

#### Scenario: AI chat title command is reported

- **WHEN** the registered ids include `aichat.setTitle`
- **THEN** the report includes `aichat.setTitle`

#### Scenario: Chat family without a title verb is omitted

- **WHEN** the registered ids include `cursor.openChat`
- **THEN** the report does not include `cursor.openChat`

#### Scenario: Title verb outside the chat families is omitted

- **WHEN** the registered ids include `workbench.action.rename`
- **THEN** the report does not include `workbench.action.rename`

#### Scenario: Unrelated Variant command is omitted

- **WHEN** the registered ids include `variant-vscode.helloworld`
- **THEN** the report does not include `variant-vscode.helloworld`

### Requirement: Report in the Cursor Command Probe channel

The probe SHALL write to an output channel named `Cursor Command Probe`, replace any earlier probe text, and show that channel. Each matching id SHALL appear once, on its own line, in lexicographic order by UTF-16 code unit. When no id matches, the channel text SHALL be the single line `No rename-like commands found in this build.`

#### Scenario: Matches are listed in order

- **WHEN** the registered ids include `composer.renameChat` and `agent.setLabel`
- **THEN** the channel named `Cursor Command Probe` is shown
- **AND** its lines are `agent.setLabel` then `composer.renameChat`

#### Scenario: No match

- **WHEN** no registered id matches
- **THEN** the channel text is the single line `No rename-like commands found in this build.`

#### Scenario: A later run replaces the earlier report

- **WHEN** the probe has already written a report
- **AND** the user runs it again against a different registered command list
- **THEN** the channel shows only the later report

### Requirement: Probe does not invoke matches

The probe SHALL NOT execute a command id it reports.

#### Scenario: A hit is listed and not run

- **WHEN** the registered ids include `composer.renameChat`
- **AND** the user runs `variant-vscode.probeCursorCommands`
- **THEN** `composer.renameChat` is not executed
