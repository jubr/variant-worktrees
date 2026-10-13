## MODIFIED Requirements

### Requirement: Shared renamer defaults and field schemas

The system SHALL provide a package `chat-renamer-config` that owns the full set of chat renamer options: `trigger` (`titleEvent` or `hook`), `hookScope` (`workspace` or `user`), `activationPatterns` (string array), `worktreePrefixes` (string array) and `renameExistingDays` (non-negative integer, 0 means off). Its main entry SHALL export the default values and the allowed values of the two enumerations without loading any schema library. Its `./schema` entry SHALL export a Zod schema for each option and a strict object schema `ChatRenamerConfigSchema` of all of them, each optional. The defaults SHALL be `titleEvent`, `workspace`, `["/[a-z]+-spec-[a-z]+\\s+@\\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\\s|$)", "/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)"]`, `[]` and `7`. The first activation pattern SHALL match a `/<word>-spec-<word> @<path>` line and capture the slug of the last path segment after its leading prefix token. The default list of worktree prefixes SHALL be empty: the host that knows the variant prefix supplies it. A worktree prefix entry SHALL be a non-empty string without path separators and holds its own leading character and connector. The renamer and `variant-config` SHALL take these defaults and schemas from this package instead of defining their own copies. The package SHALL NOT define the variant name prefix or any literal copy of it, which belongs to `variant-config`.

#### Scenario: Defaults without Zod

- **WHEN** a consumer imports the main entry
- **THEN** it receives the five defaults and does not load Zod

#### Scenario: Default activation patterns

- **WHEN** a consumer imports the main entry
- **THEN** the activation-pattern default lists the path pattern first and the slug pattern second

#### Scenario: Prefix entries

- **WHEN** the worktree prefixes schema parses `["_work-"]`, `[""]` and `["a/b"]`
- **THEN** it accepts the first and rejects the other two

#### Scenario: Day window schema

- **WHEN** the window schema parses `0`, `7`, `-1` and `1.5`
- **THEN** it accepts `0` and `7` and rejects the other two

#### Scenario: Enumerations

- **WHEN** the trigger schema parses `hook`, `titleEvent` and `poll`
- **THEN** it accepts the first two and rejects `poll`

#### Scenario: Whole section

- **WHEN** `ChatRenamerConfigSchema` parses an object with an unknown key
- **THEN** it rejects it, and an empty object is accepted

#### Scenario: One definition for variant-config

- **WHEN** `variants.yaml` sets `chatRenamer.renameExistingDays` to `-1`
- **THEN** loading fails with the shared schema's message
