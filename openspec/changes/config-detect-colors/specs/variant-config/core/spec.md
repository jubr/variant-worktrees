## MODIFIED Requirements

### Requirement: Config CLI command

The system SHALL provide a `variant config` command that prints the resolved configuration. The default text SHALL be a YAML document of that configuration, including values the loaded file did not set: built-in defaults, autodetection, and environment variables. The printed document SHALL include `db` and `variant`, and SHALL include the resolved `variant.main` and `variant.root` when those paths are known, including when `variants.yaml` omits both keys. `--json` SHALL print that same document as JSON and `--yaml` SHALL print it as YAML, both without origin comments and without color. A password SHALL be `***` in text, JSON, and YAML.

Every text line that carries a value (a scalar, null, an empty `[]` or `{}`, or a sequence item) SHALL end with a YAML comment naming the origin of that value. A line that only opens a nested mapping SHALL NOT have that comment. The comment SHALL be exactly one of:

- `# worktree` when the loaded file is the variant worktree's own `variants.yaml` or `variants.yml` and that file sets the value
- `# variants.yaml` when the loaded file is the main checkout file and that file sets the value
- `# default` when a built-in default supplies a key the loaded file omits
- `# autodetect` when the value is discovered (watches, `variant.main`, `variant.root`, the configuration path, or operational state) and the loaded file does not set it
- `# env <NAME>` when environment variable `<NAME>` supplies the printed value, including a `${NAME}` in the loaded file whose variable is set
- `# env` when the environment supplies the value and no single variable name is known

A `${NAME:-fallback}` whose variable is unset SHALL be commented as the loaded file, because the fallback text is in that file. The worktree file SHALL NOT be merged with the main file: keys come from the one file that was loaded. Stripping the comments and any color SHALL leave YAML that parses to the same value as `--json`.

When stdout is a terminal and `NO_COLOR` is unset, the text SHALL be colored in yq's YAML roles and SHALL otherwise be the same characters. A mapping key SHALL be cyan (`ESC[36m`). A string SHALL be green (`ESC[32m`). A number or a boolean SHALL be bright magenta (`ESC[95m`). A comment SHALL be bright black (`ESC[90m`). Null, `[]`, `{}`, colons, and sequence dashes SHALL NOT be colored. `ESC` is the byte `0x1B`, and `ESC[0m` SHALL restore the default after each colored span. When stdout is not a terminal, or `NO_COLOR` is set, the text SHALL contain no ANSI sequence. `--json` and `--yaml` SHALL contain no ANSI sequence.

#### Scenario: Print detected config

- **WHEN** a user runs `variant config`, `variants.yaml` omits `variant.prefix` and sets no `db`, and `POSTGRES_HOST` is `db.example`
- **THEN** stdout is the resolved configuration as YAML, including `db` and `variant`, with a `prefix` value `_v-` commented `# default` and a `host` value `db.example` commented `# env POSTGRES_HOST`

#### Scenario: Main file

- **WHEN** the main `variants.yaml` sets `variant.prefix: _work-` and the process is not using a worktree file
- **THEN** the text includes a `prefix` value `_work-` commented `# variants.yaml`
- **AND** the line that opens `variant:` has no origin comment

#### Scenario: Worktree file

- **WHEN** the process runs in a variant worktree whose own `variants.yaml` sets `variant.prefix: _wt-` and the main file sets `variant.prefix: _main-`
- **THEN** the text includes a `prefix` value `_wt-` commented `# worktree`
- **AND** the text does not contain `_main-`

#### Scenario: Autodetected watch

- **WHEN** `variant.watches` is absent and a searched subdirectory contains Vite configuration
- **THEN** a value line of that watch is commented `# autodetect`

#### Scenario: Resolved main and root

- **WHEN** `variants.yaml` sets neither `variant.main` nor `variant.root` and a user runs `variant config`
- **THEN** the text includes both resolved paths, each commented `# autodetect`
- **AND** `variant config --json` includes both paths

#### Scenario: Variable written in the file

- **WHEN** `variants.yaml` sets `db.host: ${POSTGRES_HOST}` and `POSTGRES_HOST` is `db.example`
- **THEN** the text includes a `host` value `db.example` commented `# env POSTGRES_HOST`

#### Scenario: Fallback written in the file

- **WHEN** `variants.yaml` sets `db.host: ${DB_HOST:-127.0.0.1}` and `DB_HOST` is unset
- **THEN** the text includes a `host` value `127.0.0.1` commented `# variants.yaml`

#### Scenario: Terminal colors

- **WHEN** stdout is a terminal, `NO_COLOR` is unset, and the text prints a string value and a number
- **THEN** the key is wrapped in `ESC[36m` and `ESC[0m`, the string in `ESC[32m` and `ESC[0m`, the number in `ESC[95m` and `ESC[0m`, and the origin comment in `ESC[90m` and `ESC[0m`

#### Scenario: Pipe has comments and no color

- **WHEN** stdout is not a terminal
- **THEN** the text contains the origin comments and no ANSI sequence
- **AND** parsing that YAML yields the same value as `variant config --json`

#### Scenario: NO_COLOR

- **WHEN** stdout is a terminal and `NO_COLOR` is set
- **THEN** the text contains the origin comments and no ANSI sequence

#### Scenario: Machine formats stay plain

- **WHEN** a user runs `variant config --json` or `variant config --yaml`
- **THEN** stdout has no ANSI sequence and no origin comment

#### Scenario: Redacted password keeps its origin

- **WHEN** the password is `hunter2`, supplied by the loaded file or by `POSTGRES_PASSWORD`
- **THEN** text, JSON, and YAML show `***` and do not contain `hunter2`
- **AND** the text line for the password ends with the origin comment for that source

#### Scenario: Validation error reporting

- **WHEN** a user runs `variant config` and `variants.yaml` is invalid
- **THEN** stderr shows the validation error and the exit code is 1
