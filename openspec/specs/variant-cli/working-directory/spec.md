# variant-cli/working-directory Specification

## Purpose

Changes the process directory before `variant` reads configuration, using one short global option and no long option.

## Requirements

### Requirement: Directory option before configuration

The CLI SHALL accept a global `-C <path>` and SHALL NOT accept a long form of that option. `--chdir` SHALL NOT change the directory. Before configuration is read and before the command runs, the process working directory SHALL become `<path>`. `-C` SHALL be accepted before the command name and after it. When `<path>` is written in the same argument, immediately after `-C`, that remainder SHALL be `<path>`. A relative `<path>` SHALL be resolved from the working directory in effect when that `-C` is applied. When `-C` appears more than once, each SHALL be applied from left to right. The command SHALL discover configuration from the directory that remains. A missing `<path>`, or a `<path>` that is not an existing directory, SHALL make the process exit non-zero, SHALL name `-C` on standard error, SHALL name the path when one was given, and SHALL NOT run the command. That failure SHALL happen before configuration is read.

#### Scenario: Directory before the command

- **WHEN** a user runs `variant -C <project> config` and `<project>` holds a different configuration from the starting directory
- **THEN** standard output is the configuration of `<project>`
- **AND** the starting directory's configuration is not printed

#### Scenario: Directory after the command

- **WHEN** a user runs `variant config -C <project>` and `<project>` holds a configuration
- **THEN** standard output is the configuration of `<project>`

#### Scenario: Path in the same argument

- **WHEN** a user runs `variant -C<project> config` and `<project>` holds a configuration
- **THEN** standard output is the configuration of `<project>`

#### Scenario: Relative path

- **WHEN** the process starts in `<parent>` and a user runs `variant -C child config` and `<parent>/child` holds a configuration
- **THEN** standard output is the configuration of `<parent>/child`

#### Scenario: Repeated options

- **WHEN** a user runs `variant -C <parent> -C child config` and `<parent>/child` holds a configuration
- **THEN** standard output is the configuration of `<parent>/child`

#### Scenario: Other global flag stays intact

- **WHEN** a user runs `variant -C <project> --log-level=error config` and `<project>` holds a valid configuration
- **THEN** standard output is the configuration of `<project>`
- **AND** the process exits 0

#### Scenario: Missing value

- **WHEN** a user runs `variant -C` and no path follows
- **THEN** the process exits non-zero
- **AND** standard error contains `-C`
- **AND** the command does not run

#### Scenario: Not a directory

- **WHEN** the starting directory's configuration is one `variant config` would reject, and a user runs `variant -C <absent> config` where `<absent>` is not an existing directory
- **THEN** the process exits non-zero
- **AND** standard error contains `-C` and `<absent>`
- **AND** standard error does not contain the starting directory's configuration error

#### Scenario: No long option

- **WHEN** a user runs `variant --chdir <project> config`
- **THEN** the process exits non-zero
- **AND** the configuration of `<project>` is not printed
