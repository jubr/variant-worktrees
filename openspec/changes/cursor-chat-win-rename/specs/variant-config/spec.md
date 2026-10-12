## MODIFIED Requirements

### Requirement: Seed command configuration

The system SHALL allow `variants.yaml` to define a seed command per variant (`variants.<slug>.seed`) or for all variants (`variant.seed`). The former top-level `seed` key SHALL no longer be accepted.

#### Scenario: Global seed command
- **WHEN** `variants.yaml` has `variant.seed: "bun run db:seed"`
- **THEN** `variant provision` executes that command with variant environment

#### Scenario: Per-variant seed override
- **WHEN** config has `variants.main.seed = "echo skip"` and `variant.seed = "bun run db:seed"`
- **THEN** provisioning slug `main` runs `echo skip`

#### Scenario: Former top-level seed
- **WHEN** `variants.yaml` has a top-level `seed` key
- **THEN** loading the configuration fails validation

## ADDED Requirements

### Requirement: Instance open URL

The system SHALL accept an optional `open` string on any entry of `variant.instances`: a URL template that may contain the placeholders `{{slug}}` and `{{port}}`, for example `http://{{slug}}.vw.localhost:{{port}}`. `open` SHALL NOT be an empty string. A Vite instance found by autodetection SHALL carry the default template `http://{{slug}}.vw.localhost:{{port}}`; a detected NestJS instance and an explicit instance carry only what they set. The system SHALL offer a function that returns the template of an instance with both placeholders replaced, or nothing when the instance has no template. This change does not launch the URL.

#### Scenario: Open template accepted

- **WHEN** an instance of kind `vite` or `nestjs` sets `open: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds and the resolved instance carries that exact string

#### Scenario: Empty open template

- **WHEN** an instance sets `open: ""`
- **THEN** loading the configuration fails validation

#### Scenario: Autodetected Vite instance

- **WHEN** `variant.instances` is absent and a searched subdirectory contains Vite configuration
- **THEN** the detected instance carries the default `open` template, and a detected NestJS instance carries none

#### Scenario: Placeholders replaced

- **WHEN** the URL of an instance with the default template is requested for slug `add-auth` and the instance's port is 62060
- **THEN** the result is `http://add-auth.vw.localhost:62060`

### Requirement: Instance dotenv

The system SHALL accept an optional `dotenv` string on any entry of `variant.instances`: the path of an environment file, relative to the instance's `dir`, that is copied for a variant and amended with that variant's values. The system SHALL offer a function that returns the amended text for an instance: the source file's lines with each given variable replaced in place and each missing one appended, other lines and comments kept, and values holding whitespace or `#` quoted. A missing source file SHALL count as empty. The function SHALL return nothing for an instance without `dotenv`. This change does not write the copy.

#### Scenario: Dotenv accepted

- **WHEN** an instance sets `dotenv: .env`
- **THEN** loading succeeds and the resolved instance carries it

#### Scenario: Existing variable replaced

- **WHEN** the source holds `PORT=3000` and `# keep`, and the variant values are `PORT=62061` and `POSTGRES_SCHEMA=v_demo`
- **THEN** the amended text is `PORT=62061`, `# keep` and `POSTGRES_SCHEMA=v_demo`, in that order

#### Scenario: Missing source

- **WHEN** the source file does not exist
- **THEN** the amended text holds only the variant values

#### Scenario: No dotenv

- **WHEN** the instance has no `dotenv`
- **THEN** nothing is returned

### Requirement: Local runtime state

The system SHALL read ephemeral per-variant state from `variants.local.yaml` next to `variants.yaml`, in the variant's own worktree (`<prefix><slug>/variants.local.yaml`), and carry it as `runtime` in the resolved configuration. The file holds one optional `runtime` section with `slug`, `mode` (`up` or `watch`), `dir`, `db` and `instances`. `db` SHALL reuse the database settings schema, except that `port` MAY also be a string: digits, or a `{{NAME}}` template. `instances` SHALL be a record keyed by instance name; each entry holds optional `port`, `pid` and `url`. Every `{{NAME}}` in a string SHALL be replaced by the environment variable `NAME` when the file is read; an unset variable leaves the template unchanged, and a `db.port` that is then not numeric SHALL be left out of the resolved state. Unknown keys SHALL fail validation. A missing file SHALL mean no runtime state. The system SHALL offer a function that writes the `runtime` section, validated, keeping any other top-level keys, and the repository SHALL git-ignore `variants.local.yaml`. A JSON schema file `variants.local.yaml.schema.json` and `variants.local.example.yaml` SHALL ship next to the main ones under the same rules.

#### Scenario: Runtime read

- **WHEN** `variants.local.yaml` sets `runtime.slug: demo` and `runtime.instances.fe.port: 62060`
- **THEN** the resolved configuration carries `runtime.slug` `demo` and an `fe` port of 62060

#### Scenario: Database port from the environment

- **WHEN** `runtime.db.port` is `'{{POSTGRES_PORT}}'` and `POSTGRES_PORT` is `5433`
- **THEN** the resolved `runtime.db.port` is 5433

#### Scenario: Unset environment variable

- **WHEN** `runtime.db.port` is `'{{POSTGRES_PORT}}'` and `POSTGRES_PORT` is unset
- **THEN** the resolved runtime state has no `db.port`

#### Scenario: Reused database schema

- **WHEN** `runtime.db` sets `schema: v_demo` and `dialect: postgres`
- **THEN** they validate with the rules of `db`, and `runtime.db.port: -1` fails validation

#### Scenario: No local file

- **WHEN** no `variants.local.yaml` exists
- **THEN** the resolved configuration has no runtime state

#### Scenario: Invalid local file

- **WHEN** `runtime` holds an unknown key or `instances.fe.pid` is `0`
- **THEN** loading the configuration fails validation

#### Scenario: Writing the runtime section

- **WHEN** the runtime section is written to a directory whose `variants.local.yaml` has other top-level keys
- **THEN** the file holds the new `runtime` and the other keys unchanged

### Requirement: Instance ports

The system SHALL resolve the port of an instance from `runtime.instances.<name>.port` in the local runtime state, and otherwise pick a random free port between 1024 and 65535. An instance is keyed by its `name`, or by its `kind` when it has none. The system SHALL NOT write the state when resolving.

#### Scenario: Assigned port

- **WHEN** `runtime.instances.fe.port` is 62060 and the instance is named `fe`
- **THEN** its port is 62060

#### Scenario: Unnamed instance

- **WHEN** an instance of kind `vite` has no name and `runtime.instances.vite.port` is 62060
- **THEN** its port is 62060

#### Scenario: No assignment

- **WHEN** the runtime state holds no port for the instance
- **THEN** the port is a random free port between 1024 and 65535

### Requirement: Variant name prefix

The system SHALL accept an optional `variant.prefix` in `variants.yaml`, a non-empty string without path separators, that starts every name derived from a variant slug (`<prefix><slug>`): worktree directories today, and other per-variant names such as database schemas later. The prefix SHALL carry its own leading character and connector, for example `_v-`, so no consumer inserts a separator. When absent it SHALL default to `_v-`. The default SHALL be defined in `variant-config`. The resolved configuration SHALL always carry the prefix. The system SHALL also offer a lightweight reader that returns only the prefix for a directory, without resolving database settings, and returns `_v-` when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Default prefix

- **WHEN** `variants.yaml` does not define `variant.prefix`
- **THEN** the resolved prefix is `_v-`

#### Scenario: Custom prefix

- **WHEN** `variants.yaml` defines `variant.prefix: _work-`
- **THEN** the resolved prefix is `_work-`

#### Scenario: Invalid prefix

- **WHEN** `variant.prefix` is empty or contains `/`
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the prefix

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that defines `_work-`
- **THEN** it returns `_work-` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns `_v-`

### Requirement: Chat renamer section

The system SHALL accept an optional top-level `chatRenamer` section in `variants.yaml` that carries the full set of options of `chat-renamer-config`: `trigger`, `hookScope`, `activationPatterns`, `worktreePrefixes` and `renameExistingDays`, each optional and validated by the schema owned by `chat-renamer-config`. Unknown keys inside the section SHALL fail validation. The system SHALL offer a lightweight reader that returns only this section for a directory, and an empty section when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Section with every option

- **WHEN** `variants.yaml` sets all five `chatRenamer` options to valid values
- **THEN** loading succeeds and the section is available unchanged

#### Scenario: Invalid option

- **WHEN** `chatRenamer.renameExistingDays` is `-1`
- **THEN** loading the configuration fails validation

#### Scenario: Unknown option

- **WHEN** `chatRenamer` contains a key that is not one of the five options
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the section

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that sets `chatRenamer.renameExistingDays: 30`
- **THEN** it returns `{ renameExistingDays: 30 }` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns an empty section

### Requirement: Example configuration

The package SHALL ship `variants.example.yaml` (and `variants.local.example.yaml` for the local runtime file) next to `variants.yaml.schema.json`, specifying every option of the schema with an illustrative default and listing alternatives in end-of-line comments. The example SHALL validate against the schema, and a test SHALL fail when the schema holds an option the example omits.

#### Scenario: Example validates

- **WHEN** `variants.example.yaml` is parsed and validated
- **THEN** validation succeeds

#### Scenario: Example covers the schema

- **WHEN** an option is added to the schema and not to the example
- **THEN** the coverage test fails and names the missing option
