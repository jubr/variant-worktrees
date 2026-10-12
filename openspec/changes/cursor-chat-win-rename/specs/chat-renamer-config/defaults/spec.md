## ADDED Requirements

### Requirement: Shared renamer defaults and field schemas

The system SHALL provide a package `chat-renamer-config` with a main entry that exports the renamer's default values without loading any schema library, and a `./schema` entry that exports Zod schemas for the worktree prefix, the activation patterns and the existing-chats day window. The defaults SHALL be `_v` for the worktree prefix, `["/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)"]` for the activation patterns and `7` for the day window. The worktree prefix schema SHALL accept a non-empty string without path separators. The day window schema SHALL accept a non-negative integer, where 0 means off. The renamer and `variant-config` SHALL take these defaults and schemas from this package instead of defining their own copies.

#### Scenario: Defaults without Zod

- **WHEN** a consumer imports the main entry
- **THEN** it receives the three defaults and does not load Zod

#### Scenario: Prefix schema

- **WHEN** the prefix schema parses `_work`, `""` and `a/b`
- **THEN** it accepts `_work` and rejects the other two

#### Scenario: Day window schema

- **WHEN** the window schema parses `0`, `7`, `-1` and `1.5`
- **THEN** it accepts `0` and `7` and rejects the other two

#### Scenario: One definition for variant-config

- **WHEN** `variants.yaml` sets `variant.worktreePrefix` to `a/b`
- **THEN** loading fails with the shared schema's message, and an absent prefix resolves to the shared default
