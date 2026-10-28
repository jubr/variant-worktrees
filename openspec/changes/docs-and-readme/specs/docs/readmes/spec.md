## ADDED Requirements

### Requirement: Extension description

The `variant-vscode` manifest `description` SHALL be `Git + Db schema :: provision, watch, implode`.

#### Scenario: Marketplace tagline

- **WHEN** the `variant-vscode` `package.json` is read
- **THEN** its `description` is `Git + Db schema :: provision, watch, implode`

### Requirement: Documentation link first

The repository README and the `variant-vscode` package README SHALL each link to the online documentation at `https://jubr.github.io/variant-worktrees/` before any other prose section. The link SHALL be an absolute URL so it works on the extension marketplaces.

#### Scenario: Both READMEs open with the documentation link

- **WHEN** either README is read
- **THEN** the first link to `https://jubr.github.io/variant-worktrees/` appears before the first second-level heading

### Requirement: Story-first README

Each of the two READMEs SHALL tell why before how: the first second-level section SHALL explain the problem that variants solve, and a later section SHALL show how a variant is created, watched, and imploded with `variant create`, `variant watch`, and `variant implode`.

#### Scenario: Why precedes how

- **WHEN** either README is read
- **THEN** the first second-level heading is named `Why`
- **AND** the text `variant watch` first appears after that heading
- **AND** `variant implode` appears in the README

### Requirement: Extension README is user-facing

The `variant-vscode` package README SHALL NOT contain development information: no `bun install`, `bun run`, `bun test`, `task `, `F5`, or `Extension Development Host`, and no Development heading. It SHALL describe the CLI, `variants.yaml` configuration, the MCP server, and the chat renamer.

#### Scenario: No development information

- **WHEN** the `variant-vscode` package README is read
- **THEN** it contains none of `bun install`, `bun run`, `bun test`, `F5`, or `Extension Development Host`
- **AND** it has no heading named Development

#### Scenario: Product areas present

- **WHEN** the `variant-vscode` package README is read
- **THEN** it mentions `variants.yaml`, `variant-mcp`, and `/chat-rename`

### Requirement: Repository README content

The repository README SHALL show the product, say how to install the CLI with `mise use github:jubr/variant-worktrees`, describe the human and agent workflow, and keep its `variants.yaml` configuration, CLI, MCP, and chat renamer sections. Contributor workflow SHALL be limited to a pointer to `CONTRIBUTING.md`.

#### Scenario: Install and contributor pointer

- **WHEN** the repository README is read
- **THEN** it contains `mise use github:jubr/variant-worktrees`
- **AND** it links to `CONTRIBUTING.md`
- **AND** it contains no `task lint` command
