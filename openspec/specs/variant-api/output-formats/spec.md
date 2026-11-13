# variant-api/output-formats Specification

## Purpose
The CLI prints results for people by default and as JSON or YAML on request, through global flags that behave the same on every command and are documented apart from per-command flags.

## Requirements

### Requirement: Text is the default CLI output

The `variant` CLI SHALL print a human-readable text summary of a command result to stdout, not JSON, when no output flag is given. The text SHALL be derived from the same result the JSON form holds and SHALL redact secrets like the other formats. `variant list` SHALL print its text table (see the commands capability). `variant status` SHALL print the variant facts, including its uptime and log file, followed by its runtime meta information, one value per line. Durations in text SHALL be human-readable (for example `2h 5m`), while JSON and YAML carry `uptimeSeconds` as a number.

#### Scenario: Default is not JSON

- **WHEN** a user runs `variant list` or `variant status demo` without an output flag
- **THEN** stdout is not parseable as JSON

#### Scenario: Status text

- **WHEN** a user runs `variant status demo` for a variant with mode `watch` and watch `fe` on port 62060
- **THEN** stdout names `demo`, the mode `watch`, and the port 62060 of `fe`

#### Scenario: Status text shows uptime and log

- **WHEN** variant `demo` runs a detached watch for 2 hours and 5 minutes with log `/work/_v-demo/variants.watch.log`
- **THEN** stdout shows `2h 5m` and that log path

#### Scenario: Uptime is a number in JSON

- **WHEN** a user runs `variant status demo --json` for that variant
- **THEN** `uptimeSeconds` is a number of about 7500

#### Scenario: Every command has a text form

- **WHEN** a user runs any command (`config`, `create`, `list`, `status`, `provision`, `up`, `down`, `watch`, `implode`) without an output flag
- **THEN** stdout is a text summary and not an empty output

### Requirement: Global --json and --yaml flags

The CLI SHALL accept the boolean global flags `--json` and `--yaml` on every command. `--json` SHALL print the command result as JSON with two-space indentation, exactly the result the command produced. `--yaml` SHALL print that result as YAML. The flags SHALL be accepted before and after the command name. Giving both SHALL fail with an error that names both flags and a non-zero exit status, before the command runs. The flags SHALL NOT change what a command does or its exit status, and a result with a non-zero `exitCode` SHALL still set the process exit status.

#### Scenario: JSON output

- **WHEN** a user runs `variant list --json`
- **THEN** stdout is the JSON array of variant records

#### Scenario: YAML output

- **WHEN** a user runs `variant status demo --yaml`
- **THEN** stdout is YAML that parses to the same value as the `--json` output

#### Scenario: Flag before the command

- **WHEN** a user runs `variant --json status demo`
- **THEN** stdout is the same JSON as `variant status demo --json`

#### Scenario: Conflicting flags

- **WHEN** a user runs `variant list --json --yaml`
- **THEN** the CLI prints an error naming `--json` and `--yaml`, runs nothing, and exits non-zero

#### Scenario: Exit code kept

- **WHEN** a result has `exitCode` 1 and the user passes `--json`
- **THEN** the process exits with status 1

#### Scenario: Secrets redacted

- **WHEN** a result holds a `password`
- **THEN** it is `***` in text, JSON and YAML output

### Requirement: Global flags are listed apart in help

`variant --help` and `variant <command> --help` SHALL list the global flags `--json`, `--yaml`, `--help`, and `-C <path>` in a section titled `Global flags`, separate from the flags of the command. The `-C` row SHALL show the short option and `<path>` and SHALL NOT show a long option. The per-command `Flags` section SHALL NOT repeat the global flags. From the first line of the `Global flags` section that contains a flag through the last such line, no line SHALL be empty. That absence of an empty line SHALL hold when standard output is not a terminal and when it is a terminal, including when the terminal is too narrow for a flag and its description to fit on one line. The README CLI section SHALL likewise list the global flags in a section apart from the per-command flags.

#### Scenario: Top-level help

- **WHEN** a user runs `variant --help`
- **THEN** the output has a `Global flags` section that lists `--json`, `--yaml`, and `-C`
- **AND** the `-C` row contains `<path>` and does not contain `--chdir`
- **AND** the lines of that section from the first flag line through the last flag line include no empty line

#### Scenario: Command help

- **WHEN** a user runs `variant watch --help`
- **THEN** a `Flags` section lists `--detach` and `--slug` but not `--json`, and a `Global flags` section lists `--json`, `--yaml`, and `-C`
- **AND** the lines of the `Global flags` section from the first flag line through the last flag line include no empty line

#### Scenario: Narrow terminal

- **WHEN** a user runs `variant config --help` with standard output on a terminal too narrow for `--log-level` and its description to fit on one line
- **THEN** the `Global flags` section still lists `--json` and `-C`
- **AND** the lines of that section from the first flag line through the last flag line include no empty line
