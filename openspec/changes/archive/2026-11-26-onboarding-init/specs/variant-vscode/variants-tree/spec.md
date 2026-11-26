## ADDED Requirements

### Requirement: Actions read the current configuration

Play, stop and implode, and the panel's watch, down and implode, SHALL run on the `variants.yaml` of their working directory as it is when the action starts. A `variants.yaml` that was created or changed since the previous action in that directory, by `variant init`, by the configuration migration, or by hand, SHALL be read by the next action without reloading the editor window. An unchanged file SHALL NOT be read again for every action.

#### Scenario: Watches added after the first use

- **WHEN** a person presses play on `main` while `variants.yaml` has no watch with a `watch` command, adds `watch: npm run watch` to a watch in that file, and presses play again
- **THEN** the second play starts that watch
- **AND** the editor window was not reloaded

#### Scenario: Init then play

- **WHEN** the Variants view has loaded a folder without `variants.yaml`, the onboarding runs `init`, and a person then presses play on `main`
- **THEN** the watches of the written `variants.yaml` start

#### Scenario: Unchanged file

- **WHEN** two actions run in the same directory and `variants.yaml` did not change between them
- **THEN** the second action reuses what the first one loaded
