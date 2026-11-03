# variant-vscode/config-migration Specification

## Purpose
Defines how the VS Code extension migrates a configuration that uses names of an earlier version and how it tells the user about it.

## Requirements

### Requirement: Extension rewrites a migrated configuration

When the extension loads the configuration of a workspace folder, it SHALL best-effort rewrite the file or files that need a migration (names of an earlier version, or no schema header; see `variant-config/core`) under the same rules as the `variant` command (see `variant-cli/config-migration`): `variants.yaml` when tracked by git without uncommitted changes, or, when not tracked, after saving its old text as `<file>~` (not when that backup exists), `variants.local.yaml` unconditionally, and nothing when `CI` is set to a value other than empty, `0` or `false` or when `VARIANT_MIGRATE` is `0`. It SHALL then show one warning notification per file and session that does not disappear on its own, that states the change, says whether the file was rewritten (and that git can show and revert the change, or where the backup of an untracked file is) or why it was not, and offers the action **Open file**, which opens the file in an editor, and, when it rewrote the file, the action **Undo**, which writes the text from before the rewrite back. **Undo** SHALL leave a file alone that changed since the rewrite and say so. **Undo** SHALL also remove the backup of an untracked file when it still holds that text. After **Undo** the file is rewritten again when the extension next loads it, unless `VARIANT_MIGRATE=0`, and the message after **Undo** says so. A failure to rewrite SHALL NOT stop the views from loading on the migrated reading.

#### Scenario: Rewritten and announced

- **WHEN** the extension loads a tracked, unchanged `variants.yaml` that uses `variant.instances`
- **THEN** the file uses `variant.watches` afterwards and a warning notification states the change and offers **Open file**

#### Scenario: Schema header added

- **WHEN** the extension loads a tracked, clean `variants.yaml` without a `$schema` modeline
- **THEN** the file begins with the modeline afterwards and a warning notification says that the schema header was added and offers **Open file** and **Undo**

#### Scenario: Header cannot be added

- **WHEN** only the header is missing and the file is not rewritten
- **THEN** no notification appears

#### Scenario: Untracked file

- **WHEN** the extension loads an untracked `variants.yaml` that uses `variant.instances`
- **THEN** `variants.yaml~` holds the old text, the file uses `variant.watches`, and the notification names the backup and offers **Open file** and **Undo**

#### Scenario: Not rewritten

- **WHEN** the file has uncommitted changes, its backup exists, or an opt-out applies
- **THEN** the file is unchanged and the notification gives the reason and offers **Open file** only

#### Scenario: Open file

- **WHEN** the user chooses **Open file**
- **THEN** the file opens in an editor

#### Scenario: Undo

- **WHEN** the user chooses **Undo** on the notification of a rewritten file that is unchanged since
- **THEN** the file has its text from before the rewrite again and a message says that it is rewritten on the next load unless `VARIANT_MIGRATE=0`

#### Scenario: Undo of a changed file

- **WHEN** the user chooses **Undo** after editing the rewritten file
- **THEN** the file is not changed and an error message says to revert it with git

#### Scenario: Once per file and session

- **WHEN** the configuration is loaded again in the same session
- **THEN** no second notification for that file appears
