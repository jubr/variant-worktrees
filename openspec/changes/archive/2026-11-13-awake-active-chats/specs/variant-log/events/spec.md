## ADDED Requirements

### Requirement: High-volume categories are opt-in

`variant-log` SHALL let a caller register a high-volume category id and SHALL list the registered ids in registration order, without duplicates. The awake module SHALL register `awake.agentHostEvents`. The editor SHALL offer those ids as a checkbox list. The Variant key SHALL be `variant.log.highVolumeCategories`. The standalone key SHALL be `chat-renamer.log.highVolumeCategories`. Both SHALL default to an empty selection. An id that is not selected SHALL NOT emit at any log level. A selected id SHALL be allowed to emit. Changing the selection SHALL apply without a reload.

#### Scenario: Awake registers its category

- **WHEN** the awake module has been loaded and a host lists the high-volume categories
- **THEN** the list contains `awake.agentHostEvents`

#### Scenario: Unchecked category does not emit

- **WHEN** `awake.agentHostEvents` is registered and is not selected, and a turn start would otherwise be traced
- **THEN** no log line for that event is written at any level

#### Scenario: Checked category may emit

- **WHEN** `awake.agentHostEvents` is selected and a turn start is traced
- **THEN** that trace line is written

#### Scenario: Default is none selected

- **WHEN** the user has not changed `variant.log.highVolumeCategories`
- **THEN** the selection is empty
- **AND** `awake.agentHostEvents` does not emit

#### Scenario: Checkbox list matches the registry

- **WHEN** the Variant manifest and the standalone manifest contribute the high-volume setting
- **THEN** each item the settings UI can check is a registered category id
- **AND** `awake.agentHostEvents` is one of those items
