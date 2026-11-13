## MODIFIED Requirements

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
