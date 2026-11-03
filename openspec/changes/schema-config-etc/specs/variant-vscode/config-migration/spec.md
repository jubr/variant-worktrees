## Purpose

Defines how the VS Code extension migrates a configuration that uses names of an earlier version and how it tells the user about it.

## ADDED Requirements

### Requirement: Extension rewrites a migrated configuration

When the extension loads the configuration of a workspace folder and it needed a migration (see `variant-config/core`), it SHALL best-effort rewrite the file under the same rules as the `variant` command (see `variant-cli/config-migration`): `variants.yaml` only when tracked by git and without uncommitted changes, `variants.local.yaml` unconditionally, and nothing when `CI` is set to a value other than empty, `0` or `false` or when `VARIANT_MIGRATE` is `0`. It SHALL then show one warning notification per file and session that does not disappear on its own, that states the change, says whether the file was rewritten (and that git can show and revert the change) or why it was not, and offers the action **Open file**, which opens the file in an editor. A failure to rewrite SHALL NOT stop the views from loading on the migrated reading.

#### Scenario: Rewritten and announced

- **WHEN** the extension loads a tracked, unchanged `variants.yaml` that uses `variant.instances`
- **THEN** the file uses `variant.watches` afterwards and a warning notification states the change and offers **Open file**

#### Scenario: Not rewritten

- **WHEN** the file is not tracked, has uncommitted changes, or an opt-out applies
- **THEN** the file is unchanged and the notification gives the reason and offers **Open file**

#### Scenario: Open file

- **WHEN** the user chooses **Open file**
- **THEN** the file opens in an editor

#### Scenario: Once per file and session

- **WHEN** the configuration is loaded again in the same session
- **THEN** no second notification for that file appears
