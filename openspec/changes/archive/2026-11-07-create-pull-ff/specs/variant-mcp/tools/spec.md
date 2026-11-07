## ADDED Requirements

### Requirement: pullFf on worktree-creating tools

The tools `variant_create`, `variant_provision`, `variant_up`, and `variant_watch` SHALL accept an optional boolean `pullFf`. When `pullFf` is true and that call creates the variant branch, the start branch SHALL be fast-forwarded as the core capability specifies. No other variant tool SHALL accept `pullFf`.

#### Scenario: Create with pullFf

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Provision with pullFf

- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Up with pullFf

- **WHEN** an MCP client calls `variant_up({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Watch with pullFf

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Other tools reject pullFf

- **WHEN** an MCP client calls `variant_down` or `variant_implode` with `pullFf`
- **THEN** the tool rejects the argument
