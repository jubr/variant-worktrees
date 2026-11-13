## MODIFIED Requirements

### Requirement: Config CLI command

The system SHALL provide a `variant config` command that prints the resolved configuration. The default text SHALL be a YAML document of that configuration, including values the loaded file did not set: built-in defaults, autodetection, and environment variables. The printed document SHALL include `db` and `variant`, and SHALL include the resolved `variant.main` and `variant.root` when those paths are known, including when `variants.yaml` omits both keys. `--json` SHALL print that same document as JSON and `--yaml` SHALL print it as YAML, both without origin comments and without color. A password SHALL be `***` in text, JSON, and YAML.

An origin comment SHALL be one of:

- `# from <path>` when a file sets the value. `<path>` SHALL be that file relative to the process cwd, using `/` separators. A file inside the cwd SHALL start with `./`. A file outside it SHALL start with `..`.
- `# from env <NAME>` when environment variable `<NAME>` supplies the printed value, including a `${NAME}` in the loaded file whose variable is set
- `# autodetect <reason>` when the value is discovered and the loaded file does not set it. `<reason>` SHALL be one word: `main`, `root`, `watch`, `config`, `runtime`, `connection`, or `abbr`
- `# default` when a built-in default supplies a key the loaded file omits

A `${NAME:-fallback}` whose variable is unset SHALL be commented as the loaded file, because the fallback text is in that file. The worktree file SHALL NOT be merged with the main file: keys come from the one file that was loaded.

A mapping or sequence SHALL carry the comment for the origin of that key. A descendant whose origin equals that comment SHALL NOT be commented. A descendant whose origin differs SHALL be commented on its own line. A key whose every descendant shares one origin SHALL carry that comment on the key line only. Stripping the comments and any color SHALL leave YAML that parses to the same value as `--json`.

When stdout is a terminal and `NO_COLOR` is unset, the text SHALL be colored in yq's YAML roles and SHALL otherwise be the same characters. A mapping key SHALL be cyan (`ESC[36m`). A string SHALL be green (`ESC[32m`). A number or a boolean SHALL be bright magenta (`ESC[95m`). A comment SHALL be bright black (`ESC[90m`). Null, `[]`, `{}`, colons, and sequence dashes SHALL NOT be colored. `ESC` is the byte `0x1B`, and `ESC[0m` SHALL restore the default after each colored span. When stdout is not a terminal, or `NO_COLOR` is set, the text SHALL contain no ANSI sequence. `--json` and `--yaml` SHALL contain no ANSI sequence.

#### Scenario: Print detected config

- **WHEN** a user runs `variant config` with cwd at the directory of `variants.yaml`, that file omits `variant.prefix` and sets no `db`, and `POSTGRES_HOST` is `db.example`
- **THEN** stdout is the resolved configuration as YAML, including `db` and `variant`
- **AND** `prefix` is `_v-` and `# default` is the comment on that line or on an ancestor that covers it
- **AND** the `host` line is `db.example` commented `# from env POSTGRES_HOST`

#### Scenario: Main file

- **WHEN** cwd is the directory of the main `variants.yaml`, that file sets `variant.prefix: _work-`, and the process is not using a worktree file
- **THEN** the `variant` line is commented `# from ./variants.yaml`
- **AND** the `prefix` line is `_work-` and has no origin comment

#### Scenario: Worktree file

- **WHEN** cwd is a variant worktree whose own `variants.yaml` sets `variant.prefix: _wt-` and the main file sets `variant.prefix: _main-`
- **THEN** the `variant` line is commented `# from ./variants.yaml` and `prefix` is `_wt-` with no origin comment
- **AND** the text does not contain `_main-`

#### Scenario: Main file from a worktree cwd

- **WHEN** cwd is a variant worktree that has no `variants.yaml`, and the loaded file is `variants.yaml` in the parent directory
- **THEN** a value set in that file is covered by the comment `# from ../variants.yaml`

#### Scenario: Same origin on the parent

- **WHEN** cwd is the directory of `variants.yaml` and that file sets `chatRenamer.trigger` and `chatRenamer.renameExistingDays` and no other `chatRenamer` key
- **THEN** the `chatRenamer` line is commented `# from ./variants.yaml`
- **AND** the `trigger` and `renameExistingDays` lines have no origin comment

#### Scenario: Override on the child

- **WHEN** cwd is the directory of `variants.yaml`, that file sets `variant.prefix` to a literal and `variant.seed` to `${VARIANT_SEED}`, and `VARIANT_SEED` is `echo ok`
- **THEN** the `variant` line is commented `# from ./variants.yaml`
- **AND** the `prefix` line has no origin comment
- **AND** the `seed` line is commented `# from env VARIANT_SEED`

#### Scenario: Autodetected watch

- **WHEN** `variant.watches` is absent and a searched subdirectory contains Vite configuration
- **THEN** that watch's key line is commented `# autodetect watch`
- **AND** the lines under that key have no origin comment

#### Scenario: Resolved main and root

- **WHEN** `variants.yaml` sets neither `variant.main` nor `variant.root` and a user runs `variant config`
- **THEN** the `main` line is commented `# autodetect main` and the `root` line is commented `# autodetect root`
- **AND** `variant config --json` includes both paths

#### Scenario: Variable written in the file

- **WHEN** `variants.yaml` sets `db.host: ${POSTGRES_HOST}` and `POSTGRES_HOST` is `db.example`
- **THEN** the `host` line is `db.example` commented `# from env POSTGRES_HOST`

#### Scenario: Fallback written in the file

- **WHEN** cwd is the directory of `variants.yaml`, that file sets `db.host: ${DB_HOST:-127.0.0.1}`, and `DB_HOST` is unset
- **THEN** `host` is `127.0.0.1`
- **AND** `# from ./variants.yaml` is the comment on the `host` line or on the `db` line that covers it
- **AND** the `host` line contains no `# from env`

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
- **AND** the text includes `# from ./variants.yaml` or `# from env POSTGRES_PASSWORD` for that source, on the password line or on an ancestor that covers it

#### Scenario: Validation error reporting

- **WHEN** a user runs `variant config` and `variants.yaml` is invalid
- **THEN** stderr shows the validation error and the exit code is 1
