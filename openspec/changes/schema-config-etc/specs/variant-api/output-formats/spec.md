## MODIFIED Requirements

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
