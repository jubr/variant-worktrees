# variant-api commands Specification

## Purpose

Declarative command definitions expose one consistent lifecycle contract across
the CLI, MCP server, and VS Code webview interfaces.

## Requirements

### Requirement: CommandDefinition schema

The system SHALL define commands as typed objects with name, description, args, and execute function.

#### Scenario: Valid command definition
- **WHEN** a command is registered
- **THEN** the object has `name: keyof VariantClient`, `description: string`, `args: ArgDefinition[]`, and `execute: (client, args) => Promise<unknown>`

#### Scenario: ArgDefinition structure
- **WHEN** a command declares an argument
- **THEN** the argument has `name: string`, `description: string`, `type: "string" | "number" | "boolean"`, and `required: boolean`

### Requirement: CLI routing from commands

The system SHALL auto-generate cleye CLI routing from the `commands[]` array.

#### Scenario: CLI discovers commands
- **WHEN** the CLI boots
- **THEN** each `commands[i]` becomes a cleye subcommand

#### Scenario: No arguments show help
- **WHEN** a user runs `variant` without arguments
- **THEN** the CLI produces the same top-level command help as `variant --help`

#### Scenario: Arg parsing
- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `execute()` receives `{ slug: "test-feature" }`

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-cli` package, not a fixed number. `variant --version` SHALL print the version token and a parenthetical on the first line, then a cursive ASCII drawing of the words `Variant-Worktrees`, then a blank line, then one details line. The drawing SHALL be the same text on every run and SHALL occupy more than one line. When standard output is a terminal and `NO_COLOR` is unset, the drawing SHALL be colored orange, each hyphen glyph in that drawing SHALL be the default terminal color via an ANSI reset with the orange color resumed after the glyph, and the first line and the details line SHALL NOT be colored. Otherwise the drawing SHALL be those same glyphs with no ANSI color sequences.

On a build from the `main` branch, and when the commit id cannot be determined, the parentheses SHALL contain the UTC date as `YYYY-MM-DD`. On a build from any other branch the parentheses SHALL contain the UTC time as `YYYY-MM-DD HH:MM:SS`. The details line SHALL be the runtime platform, a comma and a space, then the GitHub repository URL `https://github.com/jubr/variant-worktrees`. The details line SHALL NOT contain a date or a commit hash. The platform SHALL be `macos` when the runtime is Darwin, `linux` when it is Linux, and `windows` when it is Windows, then a hyphen, then the runtime CPU architecture, as in `macos-arm64`. For a run from source that parenthetical SHALL use the UTC clock of that run. For the built `dist/` and for a compiled single-file executable it SHALL use the UTC clock of that build, including when the artifact runs outside that checkout.

On a build from the `main` branch the version token SHALL be the package version. On a build from any other branch the version token SHALL be the package version, a hyphen, and `{slug}-{n}-{hash4}`. `slug` SHALL be that branch with a variant branch prefix removed (`feat/`, `fix/`, `feature/`) and with every other character that is not a letter or digit turned into a single hyphen. `n` SHALL be the number of commits after the nearest tag reachable from that commit, or the number of commits in the history when no tag is reachable. `{hash4}` SHALL be the first four characters of the full lowercase hexadecimal commit id and SHALL NOT be lengthened to stay unique. A branch that is not `main` and has `n` of zero SHALL still use that suffix. When that commit id cannot be determined, the version token SHALL be the package version with no suffix, and the details line SHALL still contain the platform and the URL.

The first line of `variant --help` SHALL be `variant v` followed by the package version and SHALL NOT contain the banner, the platform, the date, the hash, or the URL. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag

- **WHEN** a user runs `variant --version` from source on a branch other than `main` whose commit id is known
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, a hyphen, `{slug}-{n}-{hash4}`, and parentheses containing the UTC time of that run as `YYYY-MM-DD HH:MM:SS`
- **AND** the following lines are the cursive drawing of `Variant-Worktrees`
- **AND** a blank line follows that drawing
- **AND** the last line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`
- **AND** the last line contains no date and no commit hash

#### Scenario: Version flag from a built artifact

- **WHEN** `variant --version` runs from the built `dist/` or from a compiled single-file executable, outside the checkout it was built from
- **THEN** standard output uses the parenthetical captured when that artifact was built, and the `{slug}-{n}-{hash4}` captured for that build when the branch was not `main`

#### Scenario: Version flag from main

- **WHEN** a user runs `variant --version` from a build of the `main` branch whose commit id is known
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, parentheses containing the UTC date as `YYYY-MM-DD`, and no hyphenated suffix

#### Scenario: Version flag without a commit

- **WHEN** a user runs `variant --version` and the commit id cannot be determined
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, parentheses containing the UTC date as `YYYY-MM-DD`, and no hyphenated suffix
- **AND** the last line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`, with no date and no commit hash

#### Scenario: Colored banner

- **WHEN** a user runs `variant --version` with standard output on a terminal and `NO_COLOR` unset
- **THEN** the drawing is colored orange, the hyphen glyphs in the drawing are the default terminal color, and the first line and the last line are not

#### Scenario: Plain banner

- **WHEN** a user runs `variant --version` with standard output not on a terminal, or with `NO_COLOR` set
- **THEN** the drawing has no ANSI color sequences and the last line is the platform and the URL

#### Scenario: Help header

- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-cli` `package.json`
- **AND** that line does not contain the date, the hash, or the repository URL

### Requirement: MCP tool generation

The system SHALL expose each command as an MCP tool with an auto-generated schema.

#### Scenario: MCP tool list
- **WHEN** an MCP client lists tools
- **THEN** the result includes one tool per command with name, description, and inputSchema derived from args

### Requirement: VS Code webview form generation

The system SHALL auto-generate webview forms from `ArgDefinition[]`.

#### Scenario: Render input fields
- **WHEN** a VS Code command opens a webview
- **THEN** the form has one `vscode-text-field` per argument with its label from the description

#### Scenario: Required field validation
- **WHEN** an argument has `required: true`
- **THEN** its field has the `required` attribute

### Requirement: Lifecycle commands execute in variant-api

The system SHALL execute `config`, `create`, `list`, `status`, `provision`, `up`, `down`, `watch` and `implode` in `variant-api`. The CLI and the MCP server SHALL call that logic in-process. Those commands SHALL NOT be routed to the VS Code extension. Requests that need the editor are the only socket traffic, and they are not these commands.

#### Scenario: CLI create stays in variant-api

- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `variant-api` performs the create
- **AND** the extension socket receives no request

#### Scenario: MCP list stays in variant-api

- **WHEN** an MCP client calls `variant_list`
- **THEN** `variant-api` performs the list in the MCP process
- **AND** the extension socket receives no request

#### Scenario: CLI watch stays in variant-api

- **WHEN** a user runs `variant watch --slug test-feature`
- **THEN** `variant-api` supervises the processes in the CLI process
- **AND** the extension socket receives no request

#### Scenario: CLI status stays in variant-api

- **WHEN** a user runs `variant status test-feature`
- **THEN** `variant-api` reads the status in the CLI process
- **AND** the extension socket receives no request

### Requirement: Runtime lifecycle commands

The system SHALL define the commands `up`, `down`, `watch` and `implode` next to `config`, `create`, `list` and `provision`, each with the optional `slug` argument. The commands `destroy` and `switch` SHALL NOT exist; `implode` replaces `destroy`. `watch` SHALL also take a boolean `detach`, and `implode` a boolean `force`. `create`, `provision`, `up` and `watch` SHALL also take an optional string `from`, a git commit-ish that names the start of a newly created variant branch. No other command SHALL take `from`. Every command SHALL also accept a boolean `verbose` that restores the full output of quiet provisioning steps. The CLI, the MCP server and the webview forms SHALL derive their flags, tool inputs and fields from these definitions. The CLI flag SHALL be `--from` and SHALL have no short flag.

#### Scenario: Commands registered

- **WHEN** the CLI lists its commands
- **THEN** `up`, `down`, `watch` and `implode` appear with their descriptions

#### Scenario: Watch detach flag

- **WHEN** a user runs `variant watch --detach --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", detach: true }`

#### Scenario: Implode force flag

- **WHEN** a user runs `variant implode --force demo`
- **THEN** `execute()` receives `{ slug: "demo", force: true }`

#### Scenario: Destroy replaced

- **WHEN** a user runs `variant destroy`
- **THEN** the CLI reports an unknown command and `variant --help` lists `implode`

#### Scenario: Switch removed

- **WHEN** a user runs `variant switch`
- **THEN** the CLI reports an unknown command and `variant --help` does not list `switch`
- **AND** the MCP server registers no `variant_switch` tool

#### Scenario: Verbose flag

- **WHEN** a user runs `variant provision --verbose`
- **THEN** `execute()` receives `{ verbose: true }`

#### Scenario: Create from flag

- **WHEN** a user runs `variant create --from feat/other --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", from: "feat/other" }`

#### Scenario: Implied commands take from

- **WHEN** a user runs `variant watch --from abc123 --slug demo`, `variant up --from abc123 --slug demo`, or `variant provision --from abc123 --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", from: "abc123" }` plus that command's other flags

#### Scenario: From on help

- **WHEN** a user runs `variant create --help`, `variant provision --help`, `variant up --help`, or `variant watch --help`
- **THEN** the help text lists `--from`

#### Scenario: Other commands reject from

- **WHEN** a user runs `variant down --from abc123` or `variant implode --from abc123`
- **THEN** the CLI rejects the unknown flag

### Requirement: List default output

The system SHALL print `variant list` as a text table with the columns `slug`, `mode`, `uptime`, `url`, `log` and `dir`, one row per variant sorted by slug, with `-` for a missing value. `url` SHALL be the complete URL of the first watch that has one, never shortened. `uptime` SHALL be the human-readable `uptimeSeconds` of the variant. `log` SHALL be the absolute path of the log file of its detached watch. `dir` SHALL be shown relative to the variant root. The `--table` flag SHALL NOT exist. `variant list --json` and `--yaml` SHALL print the records instead (see the output-formats capability).

#### Scenario: Table output

- **WHEN** variant `alpha` runs a detached watch for 5 minutes with URL `http://alpha.vw.localhost:62060/` and a log file, variant `beta` has a database only, and a user runs `variant list`
- **THEN** stdout holds a header row and two rows in that order
- **AND** the `alpha` row shows `watch`, `5m`, the full URL, the absolute log path and its directory
- **AND** `beta` shows `-` for mode, uptime, URL, log and directory

#### Scenario: Full URL

- **WHEN** a URL is longer than any other cell of its column
- **THEN** the table shows it complete

#### Scenario: JSON on request

- **WHEN** a user runs `variant list --json`
- **THEN** stdout is the JSON array of records, each with the fields of the minimal set (`slug`, `mode`, `uptimeSeconds`, `url`, `log`, `worktree`)

#### Scenario: Table flag removed

- **WHEN** a user runs `variant list --table`
- **THEN** the CLI reports an unexpected flag and exits non-zero

### Requirement: Verbose list

`variant list` SHALL accept the boolean `verbose` argument. With it, every record SHALL carry all the meta information that `status` returns for that variant (including the `runtime` object, with passwords redacted), and the text output SHALL print each variant as the `status` text does, separated by a blank line, instead of the table. The result for each variant SHALL equal the result of `status` for its slug.

#### Scenario: Verbose records equal status

- **WHEN** variants `alpha` and `beta` exist and a user runs `variant list --verbose --json`
- **THEN** the array holds two records, each equal to the output of `variant status <slug> --json`

#### Scenario: Verbose text

- **WHEN** a user runs `variant list -v` and `alpha` has a runtime state with database settings
- **THEN** stdout shows the database settings and each watch's port, pid and URL of `alpha` the same way `variant status alpha` does

#### Scenario: Minimal by default

- **WHEN** a user runs `variant list --json` without `verbose`
- **THEN** the records have no `runtime` object

### Requirement: Short verbose flag

The CLI SHALL accept `-v` as the short form of `--verbose` on every command that has `--verbose`. `--version` SHALL remain the only way to print the version.

#### Scenario: Short flag

- **WHEN** a user runs `variant list -v`
- **THEN** `execute()` receives `{ verbose: true }`

#### Scenario: Version unaffected

- **WHEN** a user runs `variant --version`
- **THEN** the output is the version and not a verbose listing
